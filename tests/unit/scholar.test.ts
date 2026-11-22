import { it, expect, vi } from "vitest";
import { SerpApiScholar } from "../../modules/busca-scholar/provider.js";
import fixture from "../fixtures/scholar.json";
it("adaptador HTTP envia engine/paginação, interpreta campos e usa cache", async () => {
  const request = vi.fn(async (url: any) => {
    expect(new URL(url).searchParams.get("engine")).toBe("google_scholar");
    expect(new URL(url).searchParams.get("start")).toBe("10");
    return Response.json(fixture);
  });
  const p = new SerpApiScholar("test-key", request as typeof fetch);
  const result = await p.buscar("ciência", 2);
  expect(result.itens[0]).toMatchObject({
    titulo: "Pesquisa e colaboração",
    publicacao: "2024",
    autores: ["Ana Silva"],
  });
  expect(result.itens[1].publicacao).toBeNull();
  await p.buscar("ciência", 2);
  expect(request).toHaveBeenCalledOnce();
});
it("sem chave não chama rede", async () => {
  const req = vi.fn();
  await expect(
    new SerpApiScholar(undefined, req).buscar("a", 1),
  ).rejects.toMatchObject({ codigo: "BUSCA_NAO_CONFIGURADA" });
  expect(req).not.toHaveBeenCalled();
});
it.each([429, 500, 401])("trata erro HTTP %i", async (status) => {
  await expect(
    new SerpApiScholar("k", async () => new Response("", { status })).buscar(
      "a",
      1,
    ),
  ).rejects.toMatchObject({ status: 503 });
});
it("trata timeout sem vazar segredo", async () => {
  await expect(
    new SerpApiScholar("secret", async () => {
      throw new Error("secret");
    }).buscar("a", 1),
  ).rejects.toMatchObject({ codigo: "PROVEDOR_INDISPONIVEL" });
});
it.each([
  { error: "bad key" },
  { x: 1 },
  {
    organic_results: [
      { title: "x", result_id: "a", link: "javascript:alert(1)" },
    ],
  },
])("trata resposta inválida %j", async (raw) => {
  await expect(
    new SerpApiScholar("k", async () => Response.json(raw)).buscar("a", 1),
  ).rejects.toMatchObject({ codigo: "RESPOSTA_PROVEDOR_INVALIDA" });
});
