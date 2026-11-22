import { defineComponent, h } from "vue";
import type { ModuloCliente } from "../../../packages/module-sdk/src/client.js";
const Tela = defineComponent({
  setup: () => () =>
    h("section", { class: "card" }, [
      h("h2", "Módulo de exemplo"),
      h("p", "Tela e aba contribuídas sem alterar o núcleo."),
    ]),
});
export default {
  manifesto: {
    id: "exemplo",
    nome: "Exemplo instalável",
    versao: 1,
    apiVersion: 1,
    capacidades: ["exemplo"],
  },
  inicializar(r) {
    r.registrarTela("/exemplo", Tela);
    r.escutarEvento("listarItensDeNavegacao", (lista) => {
      lista.push({
        id: "exemplo.nav",
        proprietario: "exemplo",
        rotulo: "Exemplo",
        path: "/exemplo",
      });
    });
    r.escutarEvento("listarAbasDoProjeto", (lista) => {
      lista.push({
        id: "exemplo.aba",
        proprietario: "exemplo",
        rotulo: "Exemplo",
        component: Tela,
      });
    });
  },
} satisfies ModuloCliente;
