import { z } from "zod";
import { AppError, fonteSchema } from "../../packages/shared/src/index.js";
export interface ProvedorBibliografico {
  buscar(
    q: string,
    pagina: number,
  ): Promise<{
    itens: ResultadoBibliografico[];
    pagina: number;
    mais: boolean;
    origem: string;
  }>;
}
export interface ResultadoBibliografico {
  titulo: string;
  autores: string[];
  link?: string | null;
  publicacao?: string | null;
  provedor: string;
  externo_id: string;
  bibtex: string;
}
const responseSchema = z.object({
  error: z.string().optional(),
  organic_results: z
    .array(
      z.object({
        title: z.string(),
        result_id: z.string(),
        link: z.string().optional(),
        publication_info: z
          .object({
            summary: z.string().optional(),
            authors: z.array(z.object({ name: z.string() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  serpapi_pagination: z.object({ next: z.string().optional() }).optional(),
});
export class SerpApiScholar implements ProvedorBibliografico {
  private cache = new Map<
    string,
    {
      expires: number;
      value: Awaited<ReturnType<ProvedorBibliografico["buscar"]>>;
    }
  >();
  constructor(
    private key?: string,
    private request: typeof fetch = fetch,
  ) {}
  async buscar(q: string, pagina: number) {
    if (!this.key)
      throw new AppError(
        503,
        "BUSCA_NAO_CONFIGURADA",
        "Busca integrada indisponível: o operador precisa configurar SERPAPI_API_KEY. Você pode cadastrar fontes manualmente ou abrir o Google Scholar.",
      );
    const cacheKey = JSON.stringify([q, pagina]);
    for (const [key, item] of this.cache)
      if (item.expires < Date.now()) this.cache.delete(key);
    const hit = this.cache.get(cacheKey);
    if (hit) return hit.value;
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({
      engine: "google_scholar",
      q,
      hl: "pt",
      start: String((pagina - 1) * 10),
      api_key: this.key,
    }).toString();
    let response: Response;
    try {
      response = await this.request(url, {
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new AppError(
        503,
        "PROVEDOR_INDISPONIVEL",
        "Busca indisponível ou tempo de resposta excedido. Tente novamente.",
      );
    }
    if (response.status === 429)
      throw new AppError(
        503,
        "QUOTA_PROVEDOR",
        "A quota do provedor foi atingida. Cadastre fontes manualmente.",
      );
    if (!response.ok)
      throw new AppError(
        503,
        "PROVEDOR_INDISPONIVEL",
        "O provedor não conseguiu realizar a busca.",
      );
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new AppError(
        503,
        "RESPOSTA_PROVEDOR_INVALIDA",
        "O provedor devolveu uma resposta inválida",
      );
    }
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success || parsed.data.error || !parsed.data.organic_results)
      throw new AppError(
        503,
        "RESPOSTA_PROVEDOR_INVALIDA",
        "O provedor devolveu erro ou dados inválidos",
      );
    const itens = parsed.data.organic_results.map((x) => {
      const year = x.publication_info?.summary?.match(/\b(19|20)\d{2}\b/)?.[0];
      const result = {
        titulo: x.title,
        autores: x.publication_info?.authors?.map((a) => a.name) ?? [],
        link: x.link ?? null,
        publicacao: year ?? null,
        provedor: "serpapi-google-scholar",
        externo_id: x.result_id,
        bibtex: "",
      };
      if (!fonteSchema.safeParse(result).success)
        throw new AppError(
          503,
          "RESPOSTA_PROVEDOR_INVALIDA",
          "O provedor devolveu metadados inválidos",
        );
      return result;
    });
    const value = {
      itens,
      pagina,
      mais: !!parsed.data.serpapi_pagination?.next,
      origem: "Google Scholar via SerpApi (serviço terceiro)",
    };
    if (this.cache.size >= 500)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(cacheKey, { expires: Date.now() + 600000, value });
    return value;
  }
}
