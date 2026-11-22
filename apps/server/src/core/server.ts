import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { ZodError } from "zod";
import { Banco, migrarCore } from "../persistence/database.js";
import { Dominio } from "../domain/service.js";
import { config, type Config } from "./config.js";
import { Sessoes } from "./session.js";
import { RegistroDeModulos } from "./registry.js";
import { rotasBase } from "../http/routes.js";
import type { ModuloServidor } from "../../../../packages/module-sdk/src/server.js";
export class Servidor {
  readonly app = express();
  readonly banco: Banco;
  readonly dominio: Dominio;
  readonly sessoes: Sessoes;
  readonly registro: RegistroDeModulos;
  readonly config: Config;
  private ready = false;
  constructor(options: Partial<Config> = {}) {
    this.config = config(options);
    this.banco = new Banco(this.config.database);
    this.dominio = new Dominio(this.banco, this.config);
    this.sessoes = new Sessoes(this.banco, this.config);
    this.registro = new RegistroDeModulos(this.app, {
      banco: this.banco,
      dominio: this.dominio,
      sessoes: this.sessoes,
      config: this.config,
    });
  }
  async inicializar(mods?: ModuloServidor[]) {
    try {
      migrarCore(this.banco);
      this.app.disable("x-powered-by");
      this.app.use(
        helmet({
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: this.config.secure ? [] : null,
            },
          },
        }),
      );
      this.app.use((req, res, next) => {
        req.requestId = randomUUID();
        res.set("X-Request-ID", req.requestId);
        if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
        next();
      });
      this.app.use(express.json({ limit: this.config.jsonLimit }));
      this.app.use(this.sessoes.middleware);
      this.app.use("/api", this.sessoes.csrf);
      rotasBase(this.registro);
      await this.registro.carregar(this.config.modulesFile, mods);
      this.app.use("/api", (_req, res) =>
        res.status(404).json({
          erro: { codigo: "NAO_ENCONTRADO", mensagem: "Rota não encontrada" },
        }),
      );
      const client = resolve("dist/client");
      if (existsSync(client)) {
        this.app.use(express.static(client));
        this.app.get("/{*path}", (_req, res) =>
          res.sendFile(resolve(client, "index.html")),
        );
      }
      this.app.use(
        (
          error: any,
          req: express.Request,
          res: express.Response,
          _next: express.NextFunction,
        ) => {
          const validation = error instanceof ZodError;
          const status = validation
            ? 400
            : error.code === "LIMIT_FILE_SIZE" ||
                error.type === "entity.too.large"
              ? 413
              : (error.status ?? 500);
          const codigo = validation
            ? "VALIDACAO"
            : error.code?.startsWith("LIMIT_")
              ? "UPLOAD_INVALIDO"
              : (error.codigo ??
                (status === 413
                  ? "LIMITE_EXCEDIDO"
                  : status === 400
                    ? "JSON_INVALIDO"
                    : "ERRO_INTERNO"));
          if (status >= 500)
            console.error(
              JSON.stringify({
                requestId: req.requestId,
                modulo: res.locals.module ?? "core",
                codigo,
                status,
              }),
            );
          res.status(status).json({
            erro: {
              codigo,
              mensagem: validation
                ? "Confira os campos informados"
                : status >= 500
                  ? "Não foi possível concluir a operação"
                  : error.message,
              campos: validation ? error.flatten() : undefined,
              detalhes: error.detalhes,
            },
          });
        },
      );
      this.ready = true;
      return this;
    } catch (e) {
      await this.close();
      throw e;
    }
  }
  servir() {
    if (!this.ready) throw new Error("Inicialize o servidor antes de servir");
    return this.app.listen(this.config.port, "127.0.0.1", () =>
      console.log(`Trama em http://127.0.0.1:${this.config.port}`),
    );
  }
  async close() {
    await this.registro.close();
    this.banco.close();
  }
}
