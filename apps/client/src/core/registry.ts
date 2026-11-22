import { markRaw, type Component } from "vue";
import type { Router } from "vue-router";
import type {
  RegistroCliente,
  Eventos,
  ModuloCliente,
  Contribuicao,
} from "../../../../packages/module-sdk/src/client.js";
import {
  ordenarModulos,
  type Papel,
} from "../../../../packages/shared/src/index.js";
export class RegistroDeModulos implements RegistroCliente {
  private events = new Map<keyof Eventos, ((...args: any[]) => void)[]>();
  private telas = new Set<string>();
  private caminhos = new Set<string>();
  owner = "core";
  diagnosticos: string[] = [];
  capabilities: { id: string; versao: number; capacidades: string[] }[] = [];
  constructor(private router: Router) {
    for (const route of router.getRoutes()) {
      this.telas.add(String(route.name));
      this.caminhos.add(route.path);
    }
  }
  temCapacidade(cap: string) {
    return this.capabilities.some((m) => m.capacidades.includes(cap));
  }
  registrarTela(
    nome: string,
    page: Component,
    meta: { path?: string; publica?: boolean; papeis?: Papel[] } = {},
  ) {
    const path = meta.path ?? nome;
    if (this.telas.has(nome) || this.caminhos.has(path))
      throw new Error(`Tela/rota duplicada: ${nome}`);
    this.telas.add(nome);
    this.caminhos.add(path);
    this.router.addRoute({
      name: nome,
      path,
      component: markRaw(page),
      meta: { publica: meta.publica ?? false, papeis: meta.papeis },
    });
  }
  escutarEvento<K extends keyof Eventos>(
    nome: K,
    callback: (...args: Eventos[K]) => void,
  ) {
    const arr = this.events.get(nome) ?? [];
    arr.push(callback as (...args: any[]) => void);
    this.events.set(nome, arr);
    return () => {
      const index = arr.indexOf(callback as (...args: any[]) => void);
      if (index >= 0) arr.splice(index, 1);
    };
  }
  dispararEvento<K extends keyof Eventos>(nome: K, args: Eventos[K]) {
    for (const cb of this.events.get(nome) ?? []) cb(...args);
    const list = args[0] as Contribuicao[];
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) throw new Error(`Contribuição duplicada: ${x.id}`);
      seen.add(x.id);
    }
    list.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  }
  inicializar(
    mods: ModuloCliente[],
    options: Record<string, Record<string, unknown>>,
  ) {
    for (const m of ordenarModulos(mods)) {
      const server = this.capabilities.find((c) => c.id === m.manifesto.id);
      if (
        m.manifesto.capacidades.length &&
        (!server ||
          server.versao < m.manifesto.versao ||
          m.manifesto.capacidades.some((c) => !server.capacidades.includes(c)))
      ) {
        this.diagnosticos.push(
          `${m.manifesto.nome}: recurso oculto por incompatibilidade com o servidor.`,
        );
        continue;
      }
      this.owner = m.manifesto.id;
      m.inicializar(this, options[this.owner]);
    }
    this.owner = "core";
  }
}
