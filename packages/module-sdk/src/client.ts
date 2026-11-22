import type { Component } from "vue";
import type { Manifesto, Papel, ProjetoDTO } from "../../shared/src/index.js";
export interface Contribuicao {
  id: string;
  proprietario: string;
  rotulo: string;
  ordem?: number;
  papeis?: Papel[];
  path?: string;
  component?: Component;
  executar?: (contexto: ContextoProjeto) => Promise<void>;
}
export interface ContextoProjeto {
  projeto: ProjetoDTO;
  salvar: () => Promise<boolean>;
  download: (url: string, body: unknown, nome: string) => Promise<void>;
}
export interface Eventos {
  listarBotoesDeLogin: [Contribuicao[]];
  listarItensDeNavegacao: [Contribuicao[]];
  listarAbasDoProjeto: [Contribuicao[], ContextoProjeto];
  listarAcoesDoProjeto: [Contribuicao[], ContextoProjeto];
}
export interface RegistroCliente {
  registrarTela(
    nome: string,
    page: Component,
    meta?: { path?: string; publica?: boolean; papeis?: Papel[] },
  ): void;
  escutarEvento<K extends keyof Eventos>(
    nome: K,
    callback: (...args: Eventos[K]) => void,
  ): () => void;
  dispararEvento<K extends keyof Eventos>(nome: K, args: Eventos[K]): void;
  temCapacidade(cap: string): boolean;
}
export interface ModuloCliente {
  manifesto: Manifesto;
  inicializar(
    registro: RegistroCliente,
    opcoes?: Record<string, unknown>,
  ): void;
}
