import type { ModuloCliente } from "../../packages/module-sdk/src/client.js";
export default {
  manifesto: {
    id: "exportacao-basica",
    nome: "Exportação PDF",
    versao: 1,
    apiVersion: 1,
    capacidades: ["exportacao-pdf"],
  },
  inicializar(r) {
    r.escutarEvento("listarAcoesDoProjeto", (lista) => {
      lista.push({
        id: "exportacao-basica.pdf",
        proprietario: "exportacao-basica",
        rotulo: "↓ Exportar PDF",
        executar: async (ctx) => {
          if (await ctx.salvar())
            await ctx.download(
              `/api/projetos/${ctx.projeto.id}/exportacoes/pdf`,
              { versao: ctx.projeto.versao },
              "projeto.pdf",
            );
        },
      });
    });
  },
} satisfies ModuloCliente;
