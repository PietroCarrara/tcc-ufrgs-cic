import { z } from "zod";
import type { ModuloServidor } from "../../packages/module-sdk/src/server.js";
import { uuid, versao } from "../../packages/shared/src/index.js";
import { ExportacaoBasica, type Snapshot } from "./pdf.js";
export const manifesto = {
  id: "exportacao-basica",
  nome: "Exportação PDF",
  versao: 1,
  apiVersion: 1 as const,
  capacidades: ["exportacao-pdf"],
};
export default {
  manifesto,
  inicializar(r) {
    const pdf = new ExportacaoBasica();
    r.aoEncerrar(() => pdf.close());
    r.registrarMetodo("exportacao-basica.exportarPDF", (snapshot: Snapshot) =>
      pdf.exportarPDF(snapshot),
    );
    r.registrarRotaAPI(
      "/api/projetos/:id/exportacoes/pdf",
      async (req, res) => {
        const { dominio: d, banco: b } = r.servicos;
        const snapshot = b.transaction(() => {
          const p = d.projeto(uuid.parse(req.params.id), req.usuario!);
          d.checkVersion(p.versao, req.body.versao);
          const imagens = Object.fromEntries(
            b
              .all(
                "SELECT id,mime,conteudo FROM arquivos WHERE projeto_id=? AND mime LIKE 'image/%'",
                p.id,
              )
              .map((f) => [f.id, { mime: f.mime, conteudo: f.conteudo }]),
          );
          return { projeto: p, fontes: d.fontes(p.id), imagens };
        });
        const bytes = await r.invocarMetodo<Buffer>(
          "exportacao-basica.exportarPDF",
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
