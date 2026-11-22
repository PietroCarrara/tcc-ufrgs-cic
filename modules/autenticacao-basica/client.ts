import type { ModuloCliente } from "../../packages/module-sdk/src/client.js";
import Login from "./Login.vue";
export default {
  manifesto: {
    id: "autenticacao-basica",
    nome: "Autenticação básica",
    versao: 1,
    apiVersion: 1,
    capacidades: ["login-basico"],
  },
  inicializar(r) {
    r.registrarTela("/autenticacao", Login, { publica: true });
    r.escutarEvento("listarBotoesDeLogin", (lista) => {
      lista.push({
        id: "autenticacao-basica.login",
        proprietario: "autenticacao-basica",
        rotulo: "Entrar com e-mail",
        path: "/autenticacao",
      });
    });
  },
} satisfies ModuloCliente;
