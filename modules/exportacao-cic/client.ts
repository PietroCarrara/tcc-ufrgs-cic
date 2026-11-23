import type { ModuloCliente } from "../../packages/module-sdk/src/client.js";
export default {
  manifesto: {
    id: "exportacao-cic",
    nome: "Exportação CIC",
    versao: 1,
    apiVersion: 1,
    capacidades: ["exportacao-cic"],
  },
  inicializar(r) {
    r.escutarEvento("listarAcoesDoProjeto", (lista) => {
      lista.push({
        id: "exportacao-cic.pdf",
        proprietario: "exportacao-cic",
        rotulo: "↓ Exportar - CIC",
        executar: async (ctx) => {
          if (await ctx.salvar())
            await ctx.download(
              `/api/projetos/${ctx.projeto.id}/exportacoes/cic`,
              { versao: ctx.projeto.versao },
              "projeto.pdf",
            );
        },
      });
    });
  },
} satisfies ModuloCliente;
