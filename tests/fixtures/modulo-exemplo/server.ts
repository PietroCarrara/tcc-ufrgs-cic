import type { ModuloServidor } from "../../../packages/module-sdk/src/server.js";
export default {
  manifesto: {
    id: "exemplo",
    nome: "Exemplo instalável",
    versao: 1,
    apiVersion: 1,
    capacidades: ["exemplo"],
  },
  inicializar(r) {
    r.servicos.banco.migrar(
      "exemplo",
      1,
      "CREATE TABLE exemplo_dados(id INTEGER PRIMARY KEY,valor TEXT NOT NULL) STRICT;",
    );
    r.registrarMetodo("exemplo.saudacao", (nome: string) => `Olá, ${nome}`);
    r.registrarRotaAPI(
      "/api/exemplo",
      async (_req, res) =>
        res.json({
          mensagem: await r.invocarMetodo("exemplo.saudacao", ["pesquisador"]),
        }),
      { metodo: "get" },
    );
  },
} satisfies ModuloServidor;
