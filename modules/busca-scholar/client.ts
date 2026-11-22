import type { ModuloCliente } from "../../packages/module-sdk/src/client.js";
import Scholar from "./Scholar.vue";
export default {
  manifesto: {
    id: "busca-scholar",
    nome: "Busca Google Scholar",
    versao: 1,
    apiVersion: 1,
    capacidades: ["busca-bibliografica"],
  },
  inicializar(r) {
    r.escutarEvento("listarAbasDoProjeto", (lista) => {
      lista.push({
        id: "busca-scholar.busca",
        proprietario: "busca-scholar",
        rotulo: "Buscar referências",
        component: Scholar,
      });
    });
  },
} satisfies ModuloCliente;
