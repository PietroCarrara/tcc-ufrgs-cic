import { z } from "zod";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
import type { RegistroDeModulos } from "../core/registry.js";
import { hash } from "../core/session.js";
import { upload, validarArquivo } from "./files.js";
import {
  uuid,
  versao,
  propostaSchema,
  projetoSchema,
  intervaloSchema,
  fonteSchema,
  limitedRichSchema,
  normalizar,
  sobrepoe,
  exigir,
  AppError,
  type User,
  type FonteDTO,
} from "../../../../packages/shared/src/index.js";
const id = (req: Request, key = "id") => uuid.parse(req.params[key]);
const version = (req: Request) => versao.parse(req.body?.versao);
const pagination = (req: Request) =>
  z
    .object({
      pagina: z.coerce.number().int().min(1).default(1),
      limite: z.coerce.number().int().min(1).max(100).default(20),
    })
    .parse(req.query);
function lista<T>(req: Request, res: Response, items: T[]) {
  const { pagina, limite } = pagination(req);
  res.json({
    itens: items.slice((pagina - 1) * limite, pagina * limite),
    total: items.length,
    pagina,
    limite,
  });
}
export function rotasBase(r: RegistroDeModulos) {
  const { banco: b, dominio: d, sessoes: s, config: c } = r.servicos;
  r.registrarRotaAPI("/api/health", (_req, res) => res.json({ status: "ok" }), {
    metodo: "get",
    publica: true,
  });
  r.registrarRotaAPI(
    "/api/capabilities",
    (_req, res) => res.json(r.capabilities()),
    { metodo: "get", publica: true },
  );
  r.registrarRotaAPI(
    "/api/session",
    (req, res) => res.json(s.estado(req, res)),
    { metodo: "get", publica: true },
  );
  r.registrarRotaAPI(
    "/api/logout",
    (req, res) => {
      s.logout(req, res);
      res.status(204).end();
    },
    { publica: true },
  );
  r.registrarRotaAPI(
    "/api/me",
    (req, res) => res.json(d.perfil(req.usuario!.id)),
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/me",
    (req, res) => {
      const p = z
        .object({
          nome: z.string().trim().min(1).max(150),
          biografia: limitedRichSchema.optional(),
          sugestoes: z.array(limitedRichSchema).max(30).optional(),
        })
        .parse(req.body);
      exigir(
        req.usuario!.papel === "professor" || (!p.biografia && !p.sugestoes),
        403,
        "SEM_PERMISSAO",
        "Biografia e sugestões são campos de professor",
      );
      res.json(
        d.atualizarPerfil(req.usuario!, p.nome, p.biografia, p.sugestoes),
      );
    },
    { metodo: "patch" },
  );
  r.registrarRotaAPI(
    "/api/me/foto",
    async (req, res) => {
      const f = await validarArquivo(req.file, true);
      b.run(
        "UPDATE usuarios SET foto=?,foto_mime=?,atualizado_em=? WHERE id=?",
        f.buffer,
        f.mime,
        new Date().toISOString(),
        req.usuario!.id,
      );
      res.json(d.perfil(req.usuario!.id));
    },
    { metodo: "put", middleware: [upload(c.photoLimit)] },
  );
  r.registrarRotaAPI(
    "/api/me/foto",
    (req, res) => {
      b.run(
        "UPDATE usuarios SET foto=NULL,foto_mime=NULL,atualizado_em=? WHERE id=?",
        new Date().toISOString(),
        req.usuario!.id,
      );
      res.status(204).end();
    },
    { metodo: "delete" },
  );
  r.registrarRotaAPI(
    "/api/usuarios/:id/foto",
    (req, res) => {
      const uid = id(req),
        u = d.usuario(uid);
      exigir(
        u.id === req.usuario!.id ||
          u.papel === "professor" ||
          b.get(
            "SELECT 1 FROM membros a JOIN membros z ON a.projeto_id=z.projeto_id WHERE a.usuario_id=? AND z.usuario_id=?",
            uid,
            req.usuario!.id,
          ),
        404,
        "NAO_ENCONTRADO",
        "Foto não encontrada",
      );
      const f = b.get("SELECT foto,foto_mime FROM usuarios WHERE id=?", uid);
      exigir(f?.foto, 404, "NAO_ENCONTRADO", "Foto não encontrada");
      res
        .type(f.foto_mime)
        .set("Cache-Control", "private, max-age=60")
        .send(Buffer.from(f.foto));
    },
    { metodo: "get" },
  );
  const professor = (uid: string): Record<string, any> => {
    const p = b.get(
      "SELECT u.id,u.nome,u.foto IS NOT NULL AS foto,p.biografia_json,p.sugestoes_json,p.busca,(SELECT COUNT(DISTINCT projeto_id) FROM projeto_orientadores WHERE usuario_id=u.id) AS projetos,(SELECT COUNT(*) FROM propostas WHERE professor_id=u.id) AS propostas FROM usuarios u JOIN professores p ON p.usuario_id=u.id WHERE u.id=?",
      uid,
    );
    exigir(p, 404, "NAO_ENCONTRADO", "Professor não encontrado");
    const { biografia_json, sugestoes_json, ...rest } = p;
    return {
      ...rest,
      biografia: JSON.parse(biografia_json),
      sugestoes: JSON.parse(sugestoes_json),
    };
  };
  r.registrarRotaAPI(
    "/api/professores",
    (req, res) => {
      const q = z
        .object({
          texto: z.string().max(300).default(""),
          dias: z.string().optional(),
          inicio: z.coerce.number().optional(),
          fim: z.coerce.number().optional(),
        })
        .parse(req.query);
      let days: number[] = [];
      if (
        q.dias !== undefined ||
        q.inicio !== undefined ||
        q.fim !== undefined
      ) {
        days = z
          .array(z.number().int().min(0).max(6))
          .min(1)
          .max(7)
          .parse(q.dias?.split(",").map(Number));
        intervaloSchema.parse({
          dia: days[0],
          inicio: q.inicio,
          fim: q.fim,
          descricao: "Filtro",
        });
      }
      const terms = normalizar(q.texto).split(" ").filter(Boolean);
      const rows = b
        .all<{ usuario_id: string }>(
          "SELECT p.usuario_id FROM professores p JOIN usuarios u ON u.id=p.usuario_id ORDER BY u.nome,u.id",
        )
        .map((x) => professor(x.usuario_id))
        .filter(
          (p) =>
            terms.every((t) => p.busca.includes(t)) &&
            (!days.length ||
              days.some(
                (day) =>
                  !d.agenda(p.id).some((a) =>
                    sobrepoe(a, {
                      dia: day,
                      inicio: q.inicio!,
                      fim: q.fim!,
                      descricao: "",
                    }),
                  ),
              )),
        )
        .map(({ busca: _busca, ...p }) => p);
      lista(req, res, rows);
    },
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/professores/:id",
    (req, res) => {
      const { busca: _busca, ...p } = professor(id(req));
      res.json(p);
    },
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/propostas",
    (req, res) =>
      lista(
        req,
        res,
        b.all(
          `SELECT p.*,a.nome AS aluno_nome,u.nome AS professor_nome FROM propostas p JOIN usuarios a ON a.id=p.aluno_id JOIN usuarios u ON u.id=p.professor_id WHERE p.${req.usuario!.papel === "aluno" ? "aluno_id" : "professor_id"}=? ORDER BY p.criado_em DESC,p.id`,
          req.usuario!.id,
        ),
      ),
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/propostas",
    (req, res) =>
      res.status(201).json(d.enviarProposta(req.usuario!, req.body)),
    { schema: propostaSchema, papeis: ["aluno"] },
  );
  r.registrarRotaAPI(
    "/api/propostas/:id/aceitar",
    (req, res) =>
      res.status(201).json(d.aceitarProposta(id(req), req.usuario!)),
    { papeis: ["professor"] },
  );
  r.registrarRotaAPI(
    "/api/propostas/:id/rejeitar",
    (req, res) => {
      d.rejeitarProposta(
        id(req),
        req.usuario!,
        z.string().trim().min(1).max(5000).parse(req.body.motivo),
      );
      res.status(204).end();
    },
    { papeis: ["professor"] },
  );
  r.registrarRotaAPI(
    "/api/projetos",
    (req, res) =>
      lista(
        req,
        res,
        b.all(
          "SELECT p.id,p.titulo,p.versao,p.atualizado_em FROM projetos p JOIN membros m ON m.projeto_id=p.id WHERE m.usuario_id=? ORDER BY p.atualizado_em DESC,p.id",
          req.usuario!.id,
        ),
      ),
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id",
    (req, res) => res.json(d.projeto(id(req), req.usuario!)),
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id",
    (req, res) => {
      const project = d.projeto(id(req), req.usuario!);
      res.json(
        d.salvarProjeto(
          id(req),
          req.usuario!,
          projetoSchema.parse({
            ...project,
            ...req.body,
            versao: version(req),
          }),
        ),
      );
    },
    { metodo: "patch" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/documento",
    (req, res) => res.json(d.salvarProjeto(id(req), req.usuario!, req.body)),
    { metodo: "put", schema: projetoSchema },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/candidatos",
    (req, res) => {
      d.acesso(id(req), req.usuario!, true);
      const q = normalizar(
        z
          .string()
          .max(200)
          .parse(req.query.q ?? ""),
      );
      const members = d.membros(id(req));
      lista(
        req,
        res,
        b
          .all<User>("SELECT id,nome,papel FROM usuarios ORDER BY nome,id")
          .filter(
            (u) =>
              !members.some((m) => m.id === u.id) &&
              normalizar(u.nome).includes(q),
          ),
      );
    },
    { metodo: "get" },
  );
  for (const method of ["post", "delete"] as const)
    r.registrarRotaAPI(
      "/api/projetos/:id/membros/:usuarioId",
      (req, res) =>
        res.json(
          d.alterarMembro(
            id(req),
            req.usuario!,
            id(req, "usuarioId"),
            version(req),
            method === "delete",
          ),
        ),
      { metodo: method },
    );
  r.registrarRotaAPI(
    "/api/me/agenda",
    (req, res) =>
      res.json({ itens: d.agenda(req.usuario!.id), timezone: c.timezone }),
    { metodo: "get" },
  );
  r.registrarRotaAPI("/api/me/atividades", (req, res) =>
    res
      .status(201)
      .json(d.salvarAtividade(req.usuario!, intervaloSchema.parse(req.body))),
  );
  r.registrarRotaAPI(
    "/api/me/atividades/:id",
    (req, res) =>
      res.json(
        d.salvarAtividade(
          req.usuario!,
          intervaloSchema.parse(req.body),
          id(req),
          version(req),
        ),
      ),
    { metodo: "patch" },
  );
  r.registrarRotaAPI(
    "/api/me/atividades/:id",
    (req, res) => {
      d.excluirAtividade(req.usuario!, id(req), version(req));
      res.status(204).end();
    },
    { metodo: "delete" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/ocupacao",
    (req, res) =>
      res.json({
        itens: d.ocupacao(id(req), req.usuario!),
        timezone: c.timezone,
      }),
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/reunioes",
    (req, res) => {
      d.acesso(id(req), req.usuario!);
      res.json({
        itens: b.all(
          "SELECT id,projeto_id,dia,inicio,fim,descricao,versao FROM atividades WHERE projeto_id=? ORDER BY dia,inicio,id",
          id(req),
        ),
      });
    },
    { metodo: "get" },
  );
  for (const edit of [false, true])
    r.registrarRotaAPI(
      `/api/projetos/:id/reunioes${edit ? "/:reuniaoId" : ""}`,
      (req, res) =>
        res
          .status(edit ? 200 : 201)
          .json(
            d.salvarAtividade(
              req.usuario!,
              intervaloSchema.parse(req.body),
              edit ? id(req, "reuniaoId") : undefined,
              edit ? version(req) : undefined,
              id(req),
              z.string().max(2000).optional().parse(req.body.token),
              req.get("Idempotency-Key"),
            ),
          ),
      { metodo: edit ? "patch" : "post" },
    );
  r.registrarRotaAPI(
    "/api/projetos/:id/reunioes/:reuniaoId",
    (req, res) => {
      d.excluirAtividade(
        req.usuario!,
        id(req, "reuniaoId"),
        version(req),
        id(req),
      );
      res.status(204).end();
    },
    { metodo: "delete" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/fontes",
    (req, res) => {
      d.acesso(id(req), req.usuario!);
      lista(req, res, d.fontes(id(req)));
    },
    { metodo: "get" },
  );
  for (const edit of [false, true])
    r.registrarRotaAPI(
      `/api/projetos/:id/fontes${edit ? "/:fonteId" : ""}`,
      (req, res) => {
        const f = fonteSchema.parse(req.body);
        res.status(edit ? 200 : 201).json(
          d.salvarFonte(
            id(req),
            req.usuario!,
            {
              ...f,
              link: f.link ?? null,
              publicacao: f.publicacao ?? null,
              doi: f.doi ?? null,
              provedor: f.provedor ?? null,
              externo_id: f.externo_id ?? null,
            },
            edit ? id(req, "fonteId") : undefined,
            edit ? version(req) : undefined,
          ),
        );
      },
      { metodo: edit ? "patch" : "post" },
    );
  r.registrarRotaAPI(
    "/api/projetos/:id/fontes/:fonteId",
    (req, res) => {
      const pid = id(req),
        fid = id(req, "fonteId");
      d.acesso(pid, req.usuario!);
      b.transaction(() => {
        const f = d.fontes(pid).find((x) => x.id === fid);
        exigir(f, 404, "NAO_ENCONTRADO", "Fonte não encontrada");
        d.checkVersion(f.versao, version(req));
        d.verificarUso(pid, fid, "sourceId");
        b.run("DELETE FROM fontes WHERE id=?", fid);
      });
      res.status(204).end();
    },
    { metodo: "delete" },
  );
  r.registrarRotaAPI("/api/projetos/:id/fontes/importar-bibtex", (req, res) => {
    const pid = id(req);
    d.acesso(pid, req.usuario!);
    const input = z.string().trim().min(1).max(500000).parse(req.body.bibtex);
    let citation: Cite;
    try {
      citation = new Cite(input);
    } catch {
      throw new AppError(
        400,
        "BIBTEX_INVALIDO",
        "Não foi possível interpretar o BibTeX",
      );
    }
    exigir(
      citation.data.length > 0 && citation.data.length <= 100,
      400,
      "BIBTEX_INVALIDO",
      "Importe de 1 a 100 entradas por vez",
    );
    const results = b.transaction(() =>
      citation.data.map((entry) => {
        const f = fonteSchema.parse({
          titulo: entry.title,
          autores: (entry.author ?? []).map(
            (a: any) =>
              a.literal ?? [a.given, a.family].filter(Boolean).join(" "),
          ),
          publicacao:
            entry.issued?.["date-parts"]?.[0]
              ?.map((x: number, i: number) =>
                i ? String(x).padStart(2, "0") : String(x),
              )
              .join("-") ?? null,
          link: entry.URL ?? null,
          doi: entry.DOI ?? null,
          bibtex: new Cite(JSON.stringify([entry])).format("bibtex"),
        });
        return d.persistirFonte(pid, {
          ...f,
          link: f.link ?? null,
          publicacao: f.publicacao ?? null,
          doi: f.doi ?? null,
          provedor: null,
          externo_id: null,
        } as Omit<FonteDTO, "id" | "projeto_id" | "versao">);
      }),
    );
    res.status(201).json({ itens: results });
  });
  r.registrarRotaAPI(
    "/api/projetos/:id/arquivos",
    (req, res) => {
      d.acesso(id(req), req.usuario!);
      lista(
        req,
        res,
        b.all(
          "SELECT id,nome,mime,tamanho,criado_em FROM arquivos WHERE projeto_id=? ORDER BY criado_em,id",
          id(req),
        ),
      );
    },
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/arquivos",
    async (req, res) => {
      const pid = id(req),
        uid = req.usuario!.id;
      d.acesso(pid, req.usuario!);
      const f = await validarArquivo(req.file),
        key = req.get("Idempotency-Key"),
        fingerprint = hash(Buffer.concat([Buffer.from(f.nome), f.buffer]));
      const result = b.transaction(() => {
        const replay = d.repeticao(uid, `arquivo:${pid}`, key, fingerprint);
        if (replay) return replay;
        const used = b.get(
          "SELECT COALESCE(SUM(tamanho),0) AS n FROM arquivos WHERE projeto_id=?",
          pid,
        )!.n;
        exigir(
          used + f.buffer.length <= c.projectFilesLimit,
          413,
          "COTA_ARQUIVOS",
          "Limite de arquivos do projeto excedido",
        );
        const aid = randomUUID();
        b.run(
          "INSERT INTO arquivos VALUES(?,?,?,?,?,?,?,?,?)",
          aid,
          pid,
          f.nome,
          f.mime,
          f.buffer.length,
          hash(f.buffer),
          f.buffer,
          uid,
          new Date().toISOString(),
        );
        const result = {
          id: aid,
          nome: f.nome,
          mime: f.mime,
          tamanho: f.buffer.length,
        };
        d.registrarRepeticao(uid, `arquivo:${pid}`, key!, fingerprint, result);
        return result;
      });
      res.status(201).json(result);
    },
    {
      middleware: [
        (req, _res, next) => {
          try {
            d.acesso(id(req), req.usuario!);
            next();
          } catch (e) {
            next(e);
          }
        },
        upload(c.uploadLimit),
      ],
    },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/arquivos/:arquivoId",
    (req, res) => {
      d.acesso(id(req), req.usuario!);
      const f = b.get(
        "SELECT * FROM arquivos WHERE id=? AND projeto_id=?",
        id(req, "arquivoId"),
        id(req),
      );
      exigir(f, 404, "NAO_ENCONTRADO", "Arquivo não encontrado");
      const inline = req.query.inline === "1" && f.mime.startsWith("image/");
      res
        .type(f.mime)
        .set(
          "Content-Disposition",
          `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.nome)}`,
        )
        .set("Cache-Control", "private, no-store")
        .send(Buffer.from(f.conteudo));
    },
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/projetos/:id/arquivos/:arquivoId",
    (req, res) => {
      const pid = id(req),
        fid = id(req, "arquivoId");
      d.acesso(pid, req.usuario!);
      b.transaction(() => {
        exigir(
          b.get("SELECT 1 FROM arquivos WHERE id=? AND projeto_id=?", fid, pid),
          404,
          "NAO_ENCONTRADO",
          "Arquivo não encontrado",
        );
        d.verificarUso(pid, fid, "fileId");
        b.run("DELETE FROM arquivos WHERE id=?", fid);
      });
      res.status(204).end();
    },
    { metodo: "delete" },
  );
  r.registrarRotaAPI(
    "/api/notificacoes",
    (req, res) => {
      const { pagina, limite } = pagination(req);
      res.json({
        itens: b.all(
          "SELECT id,titulo,texto,lida,link,tipo,criado_em FROM notificacoes WHERE destinatario=? ORDER BY criado_em DESC,id LIMIT ? OFFSET ?",
          req.usuario!.id,
          limite,
          (pagina - 1) * limite,
        ),
        total: b.get(
          "SELECT COUNT(*) AS n FROM notificacoes WHERE destinatario=?",
          req.usuario!.id,
        )!.n,
        naoLidas: b.get(
          "SELECT COUNT(*) AS n FROM notificacoes WHERE destinatario=? AND lida=0",
          req.usuario!.id,
        )!.n,
        pagina,
        limite,
      });
    },
    { metodo: "get" },
  );
  r.registrarRotaAPI(
    "/api/notificacoes/:id",
    (req, res) => {
      const lida = z.boolean().parse(req.body.lida);
      exigir(
        b.run(
          "UPDATE notificacoes SET lida=? WHERE id=? AND destinatario=?",
          Number(lida),
          id(req),
          req.usuario!.id,
        ).changes,
        404,
        "NAO_ENCONTRADO",
        "Notificação não encontrada",
      );
      res.json({ lida });
    },
    { metodo: "patch" },
  );
  r.registrarRotaAPI("/api/notificacoes/marcar-todas-lidas", (req, res) => {
    b.run(
      "UPDATE notificacoes SET lida=1 WHERE destinatario=?",
      req.usuario!.id,
    );
    res.json({ ok: true });
  });
}
