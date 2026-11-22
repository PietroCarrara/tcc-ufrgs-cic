import { z } from "zod";
import type { ModuloServidor } from "../../packages/module-sdk/src/server.js";
import { uuid } from "../../packages/shared/src/index.js";
import { Limite } from "../../apps/server/src/core/session.js";
import { SerpApiScholar } from "./provider.js";
export const manifesto = {
  id: "busca-scholar",
  nome: "Busca Google Scholar",
  versao: 1,
  apiVersion: 1 as const,
  capacidades: ["busca-bibliografica"],
};
export function criarModuloBusca(
  request: typeof fetch = fetch,
): ModuloServidor {
  return {
    manifesto,
    inicializar(r) {
      const provider = new SerpApiScholar(
          r.servicos.config.serpapiKey,
          request,
        ),
        limit = new Limite(20, 60000);
      r.registrarMetodo("busca-scholar.buscar", (q: string, pagina: number) =>
        provider.buscar(q, pagina),
      );
      r.registrarRotaAPI(
        "/api/projetos/:id/busca-referencias",
        async (req, res) => {
          r.servicos.dominio.acesso(uuid.parse(req.params.id), req.usuario!);
          const { q, pagina } = z
            .object({
              q: z.string().trim().min(1).max(300),
              pagina: z.coerce.number().int().min(1).max(100).default(1),
            })
            .parse(req.query);
          limit.consumir(req.usuario!.id);
          res.json(await r.invocarMetodo("busca-scholar.buscar", [q, pagina]));
        },
        { metodo: "get" },
      );
    },
  };
}
export default criarModuloBusca();
