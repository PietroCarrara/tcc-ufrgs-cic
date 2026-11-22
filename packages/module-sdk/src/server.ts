import type { Request, Response } from "express";
import type { ZodType } from "zod";
import type { Manifesto, Papel } from "../../shared/src/index.js";
import type { Banco } from "../../../apps/server/src/persistence/database.js";
import type { Dominio } from "../../../apps/server/src/domain/service.js";
import type { Sessoes } from "../../../apps/server/src/core/session.js";
import type { Config } from "../../../apps/server/src/core/config.js";
export interface OpcoesRota {
  metodo?: "get" | "post" | "put" | "patch" | "delete";
  publica?: boolean;
  papeis?: Papel[];
  schema?: ZodType;
  middleware?: import("express").RequestHandler[];
}
export interface RegistroServidor {
  readonly servicos: {
    banco: Banco;
    dominio: Dominio;
    sessoes: Sessoes;
    config: Config;
  };
  registrarRotaAPI(
    url: string,
    callback: (req: Request, res: Response) => unknown | Promise<unknown>,
    opcoes?: OpcoesRota,
  ): void;
  registrarMetodo<A extends unknown[], R>(
    nome: string,
    callback: (...args: A) => R,
  ): void;
  invocarMetodo<R>(nome: string, args: unknown[]): Promise<R>;
  aoEncerrar(callback: () => void | Promise<void>): void;
}
export interface ModuloServidor {
  manifesto: Manifesto;
  inicializar(
    registro: RegistroServidor,
    opcoes?: Record<string, unknown>,
  ): void | Promise<void>;
}
