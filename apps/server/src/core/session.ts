import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { parse, serialize } from "cookie";
import type { Request, Response, NextFunction } from "express";
import type { Banco } from "../persistence/database.js";
import type { Config } from "./config.js";
import { AppError, type User } from "../../../../packages/shared/src/index.js";
export type Sessao = {
  hash: string;
  usuario_id: string | null;
  provedor: string | null;
  csrf: string;
  criado: number;
  atividade: number;
  expira: number;
};
// Express exige declaração global para estender Request.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessao?: Sessao;
      usuario?: User;
      requestId: string;
    }
  }
}
export const hash = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
export class Sessoes {
  providers = new Set<string>();
  constructor(
    private b: Banco,
    private c: Config,
  ) {}
  middleware = (req: Request, _res: Response, next: NextFunction) => {
    const token = parse(req.headers.cookie ?? "").tcc_session;
    if (token) {
      const s = this.b.get<Sessao>(
        "SELECT * FROM sessoes WHERE hash=?",
        hash(token),
      );
      if (s) {
        const now = Date.now();
        if (
          s.expira <= now ||
          s.criado + 7 * 86400000 <= now ||
          (s.provedor && !this.providers.has(s.provedor))
        )
          this.b.run("DELETE FROM sessoes WHERE hash=?", s.hash);
        else {
          this.b.run(
            "UPDATE sessoes SET atividade=?,expira=? WHERE hash=?",
            now,
            Math.min(now + 8 * 3600000, s.criado + 7 * 86400000),
            s.hash,
          );
          req.sessao = s;
          if (s.usuario_id)
            req.usuario = this.b.get<User>(
              "SELECT id,nome,email_normalizado AS email,papel FROM usuarios WHERE id=?",
              s.usuario_id,
            );
        }
      }
    }
    next();
  };
  criar(req: Request, res: Response, u?: User, provider?: string) {
    if (req.sessao)
      this.b.run("DELETE FROM sessoes WHERE hash=?", req.sessao.hash);
    const token = randomBytes(32).toString("base64url"),
      csrf = randomBytes(32).toString("base64url"),
      now = Date.now();
    const s: Sessao = {
      hash: hash(token),
      usuario_id: u?.id ?? null,
      provedor: provider ?? null,
      csrf,
      criado: now,
      atividade: now,
      expira: now + 8 * 3600000,
    };
    this.b.run(
      "INSERT INTO sessoes VALUES(?,?,?,?,?,?,?)",
      s.hash,
      s.usuario_id,
      s.provedor,
      csrf,
      now,
      now,
      s.expira,
    );
    req.sessao = s;
    req.usuario = u;
    res.cookie("tcc_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.c.secure,
      path: "/",
      maxAge: 7 * 86400000,
    });
    return { usuario: u ?? null, csrf };
  }
  estado(req: Request, res: Response) {
    if (!req.sessao) return this.criar(req, res);
    return { usuario: req.usuario ?? null, csrf: req.sessao.csrf };
  }
  logout(req: Request, res: Response) {
    if (req.sessao)
      this.b.run("DELETE FROM sessoes WHERE hash=?", req.sessao.hash);
    res.setHeader(
      "Set-Cookie",
      serialize("tcc_session", "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: this.c.secure,
      }),
    );
  }
  csrf = (req: Request, _res: Response, next: NextFunction) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const t = req.get("x-csrf-token"),
      s = req.sessao?.csrf;
    if (
      req.get("origin") !== this.c.origin ||
      !t ||
      !s ||
      t.length !== s.length ||
      !timingSafeEqual(Buffer.from(t), Buffer.from(s))
    )
      return next(
        new AppError(
          403,
          "CSRF_INVALIDO",
          "Sessão de segurança inválida. Atualize a página.",
        ),
      );
    next();
  };
}
export class Limite {
  private buckets = new Map<string, { n: number; expira: number }>();
  constructor(
    private max: number,
    private ms: number,
  ) {}
  consumir(key: string) {
    const now = Date.now();
    for (const [k, v] of this.buckets)
      if (v.expira < now) this.buckets.delete(k);
    const v = this.buckets.get(key) ?? { n: 0, expira: now + this.ms };
    this.buckets.set(key, v);
    if (++v.n > this.max)
      throw new AppError(
        429,
        "LIMITE_EXCEDIDO",
        "Muitas tentativas. Aguarde e tente novamente.",
      );
  }
}
