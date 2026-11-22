import type { Express, Request, Response } from "express";
import type {
  RegistroServidor,
  OpcoesRota,
  ModuloServidor,
} from "../../../../packages/module-sdk/src/server.js";
import {
  exigir,
  ordenarModulos,
} from "../../../../packages/shared/src/index.js";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
export const modulesConfigSchema = z.object({
  packages: z.array(z.object({ id: z.string(), entry: z.string() })),
  enabled: z.array(z.string()),
  options: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});
export function readModules(file: string) {
  const c = modulesConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  exigir(
    new Set(c.enabled).size === c.enabled.length,
    500,
    "MODULO_DUPLICADO",
    "Módulo habilitado mais de uma vez",
  );
  exigir(
    new Set(c.packages.map((p) => p.id)).size === c.packages.length,
    500,
    "MODULO_DUPLICADO",
    "ID de pacote duplicado",
  );
  for (const id of c.enabled)
    exigir(
      c.packages.some((p) => p.id === id),
      500,
      "PACOTE_AUSENTE",
      `Pacote não declarado: ${id}`,
    );
  return c;
}
export function modulePath(entry: string, compiled = false) {
  if (entry.startsWith("./")) {
    const root = resolve(compiled ? "dist" : ".");
    const p = resolve(root, compiled ? entry.replace(/\.ts$/, ".js") : entry);
    const local = relative(root, p);
    exigir(
      !local.startsWith("..") &&
        !isAbsolute(local) &&
        /^(modules|tests\/fixtures)\//.test(local),
      500,
      "CAMINHO_MODULO",
      "Caminho local de módulo não permitido",
    );
    exigir(
      existsSync(p) && realpathSync(p).startsWith(realpathSync(root) + "/"),
      500,
      "PACOTE_AUSENTE",
      `Entrada não encontrada: ${p}`,
    );
    return pathToFileURL(p).href;
  }
  exigir(
    /^(@[\w-]+\/)?[\w-]+(\/[\w/-]+)?$/.test(entry),
    500,
    "CAMINHO_MODULO",
    "Nome de pacote inválido",
  );
  return entry;
}
export class RegistroDeModulos implements RegistroServidor {
  private rotas = new Map<string, string>();
  private metodos = new Map<
    string,
    { owner: string; fn: (...args: any[]) => unknown }
  >();
  private closers: (() => void | Promise<void>)[] = [];
  owner = "core";
  modulos: ModuloServidor[] = [];
  constructor(
    private app: Express,
    public readonly servicos: RegistroServidor["servicos"],
  ) {}
  registrarRotaAPI(
    url: string,
    callback: (req: Request, res: Response) => unknown | Promise<unknown>,
    op: OpcoesRota = {},
  ) {
    const method = op.metodo ?? "post",
      canonical = url.replace(/\/+$/, "");
    exigir(
      canonical.startsWith("/api/"),
      500,
      "ROTA_INVALIDA",
      "Rota deve começar com /api/",
    );
    const key = method + " " + canonical.replace(/:[A-Za-z0-9_]+/g, ":param");
    exigir(
      !this.rotas.has(key),
      500,
      "ROTA_DUPLICADA",
      `Colisão: ${key} (${this.owner} / ${this.rotas.get(key)})`,
    );
    this.rotas.set(key, this.owner);
    const owner = this.owner;
    this.app[method](
      canonical,
      (req, res, next) => {
        res.locals.module = owner;
        if (!op.publica && !req.usuario)
          return next(
            Object.assign(new Error("Entre para continuar"), {
              status: 401,
              codigo: "SESSAO_EXPIRADA",
            }),
          );
        if (op.papeis && !op.papeis.includes(req.usuario!.papel))
          return next(
            Object.assign(new Error("Operação não permitida para seu perfil"), {
              status: 403,
              codigo: "SEM_PERMISSAO",
            }),
          );
        next();
      },
      ...(op.middleware ?? []),
      async (req, res, next) => {
        try {
          if (op.schema) req.body = op.schema.parse(req.body);
          await callback(req, res);
        } catch (e) {
          next(e);
        }
      },
    );
  }
  registrarMetodo<A extends unknown[], R>(
    nome: string,
    callback: (...args: A) => R,
  ) {
    exigir(
      nome.startsWith(this.owner + "."),
      500,
      "METODO_INVALIDO",
      `Método deve usar namespace ${this.owner}`,
    );
    exigir(
      !this.metodos.has(nome),
      500,
      "METODO_DUPLICADO",
      `Método duplicado: ${nome}`,
    );
    this.metodos.set(nome, { owner: this.owner, fn: callback });
  }
  async invocarMetodo<R>(nome: string, args: unknown[]): Promise<R> {
    const m = this.metodos.get(nome);
    exigir(m, 500, "METODO_AUSENTE", `Método inexistente: ${nome}`);
    return (await m.fn(...args)) as R;
  }
  aoEncerrar(cb: () => void | Promise<void>) {
    this.closers.push(cb);
  }
  async close() {
    for (const f of this.closers.reverse()) await f();
  }
  async carregar(file: string, injected?: ModuloServidor[]) {
    const c = readModules(file);
    const mods: ModuloServidor[] = [];
    if (injected) mods.push(...injected);
    else
      for (const p of c.packages.filter((p) => c.enabled.includes(p.id))) {
        const m = (
          await import(modulePath(p.entry, import.meta.url.includes("/dist/")))
        ).default as ModuloServidor;
        exigir(
          m?.manifesto?.id === p.id,
          500,
          "ID_MODULO",
          `ID incompatível: ${p.id}`,
        );
        mods.push(m);
      }
    this.modulos = ordenarModulos(mods);
    exigir(
      this.servicos.config.allowNoAuth ||
        this.modulos.some((m) =>
          m.manifesto.capacidades.includes("autenticacao"),
        ),
      500,
      "AUTENTICACAO_AUSENTE",
      "Habilite pelo menos um provedor de autenticação",
    );
    for (const m of this.modulos) {
      this.owner = m.manifesto.id;
      try {
        await m.inicializar(this, c.options[this.owner]);
        if (m.manifesto.capacidades.includes("autenticacao"))
          this.servicos.sessoes.providers.add(this.owner);
      } catch (e) {
        throw new Error(`Falha ao inicializar ${this.owner}`, { cause: e });
      }
    }
    this.owner = "core";
  }
  capabilities() {
    return {
      apiVersion: 1,
      timezone: this.servicos.config.timezone,
      modules: this.modulos.map((m) => ({
        id: m.manifesto.id,
        versao: m.manifesto.versao,
        capacidades: m.manifesto.capacidades,
      })),
      buscaConfigurada: !!this.servicos.config.serpapiKey,
      limites: {
        upload: this.servicos.config.uploadLimit,
        foto: this.servicos.config.photoLimit,
        arquivosProjeto: this.servicos.config.projectFilesLimit,
      },
    };
  }
}
