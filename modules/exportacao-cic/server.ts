import { z } from "zod";
import type { ModuloServidor } from "../../packages/module-sdk/src/server.js";
import { uuid, versao } from "../../packages/shared/src/index.js";
import { ExportacaoCic, type Snapshot } from "./pdf.js";
import { arquivosDeFiguras } from "./latex.js";
export const manifesto = {
  id: "exportacao-cic",
  nome: "Exportação PDF - CIC",
  versao: 1,
  apiVersion: 1 as const,
  capacidades: ["exportacao-cic"],
};
export default {
  manifesto,
  async inicializar(r) {
    const pdf = await ExportacaoCic.inicializar();
    r.registrarMetodo("exportacao-cic.exportarPDF", (snapshot: Snapshot) =>
      pdf.exportarPDF(snapshot),
    );
    r.registrarRotaAPI(
      "/api/projetos/:id/exportacoes/cic",
      async (req, res) => {
        const { dominio: d, banco: b } = r.servicos;
        const snapshot = b.transaction(() => {
          const p = d.projeto(uuid.parse(req.params.id), req.usuario!);
          d.checkVersion(p.versao, req.body.versao);
          const imagens: Snapshot["imagens"] = {};
          for (const id of arquivosDeFiguras(p)) {
            const arquivo = b.get(
              "SELECT mime,conteudo FROM arquivos WHERE projeto_id=? AND id=? AND mime IN ('image/png', 'image/jpeg')",
              p.id,
              id,
            );
            if (arquivo)
              imagens[id] = { mime: arquivo.mime, conteudo: arquivo.conteudo };
          }
          return { projeto: p, fontes: d.fontes(p.id), imagens };
        });
        const bytes = await r.invocarMetodo<Buffer>(
          "exportacao-cic.exportarPDF",
          [snapshot],
        );
        res
          .type("application/pdf")
          .set("Content-Disposition", "attachment; filename=projeto.pdf")
          .send(bytes);
      },
      { schema: z.object({ versao }) },
    );
  },
} satisfies ModuloServidor;
