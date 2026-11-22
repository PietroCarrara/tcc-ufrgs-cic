import { describe, it, expect, vi, afterEach } from "vitest";
import {
  intervaloSchema,
  sobrepoe,
  normalizar,
  validarDocumento,
  textoDoc,
  ordenarModulos,
  type RichText,
} from "../../packages/shared/src/index.js";
import { analisar, renderDocumento } from "../../packages/shared/src/render.js";
import { Autosave } from "../../apps/client/src/core/autosave.js";
import { RegistroDeModulos } from "../../apps/client/src/core/registry.js";
import { createRouter, createMemoryHistory } from "vue-router";
import type { Contribuicao } from "../../packages/module-sdk/src/client.js";
const a = { dia: 0, inicio: 0, fim: 15, descricao: "a" };
describe("regras compartilhadas", () => {
  it("normaliza caixa e acentos", () =>
    expect(normalizar("  EDUCAÇÃO   Ciência ")).toBe("educacao ciencia"));
  it.each([0, 6])("aceita dia %i e limites do dia", (dia) =>
    expect(intervaloSchema.parse({ ...a, dia, fim: 1440 })).toMatchObject({
      dia,
    }),
  );
  it.each([
    { dia: 7 },
    { inicio: -15 },
    { fim: 1441 },
    { inicio: 1 },
    { inicio: 30, fim: 15 },
  ])("rejeita intervalo inválido %j", (bad) =>
    expect(() => intervaloSchema.parse({ ...a, ...bad })).toThrow(),
  );
  it("extremidades adjacentes não conflitam", () =>
    expect(sobrepoe(a, { ...a, inicio: 15, fim: 30 })).toBe(false));
  it("sobreposição parcial e total conflitam", () => {
    expect(sobrepoe({ ...a, fim: 30 }, { ...a, inicio: 15, fim: 45 })).toBe(
      true,
    );
    expect(sobrepoe(a, a)).toBe(true);
    expect(sobrepoe(a, { ...a, dia: 1 })).toBe(false);
  });
  it("valida texto e rejeita scripts, URLs perigosas, IDs duplicados", () => {
    expect(validarDocumento(textoDoc("<script>"))).toBeTruthy();
    for (const doc of [
      { type: "doc", content: [{ type: "script" }] },
      {
        type: "doc",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
      {
        type: "doc",
        content: [
          { type: "heading", attrs: { id: "a", level: 1 } },
          { type: "heading", attrs: { id: "a", level: 2 } },
        ],
      },
    ])
      expect(() => validarDocumento(doc)).toThrow();
    expect(
      renderDocumento(textoDoc("<script>alert(1)</script>")),
    ).not.toContain("<script>");
  });
  it("numera elementos em ordem e preserva acentos", () => {
    const doc: RichText = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { id: "s1", level: 1 },
          content: [{ type: "text", text: "Introdução" }],
        },
        { type: "heading", attrs: { id: "s2", level: 2 } },
        { type: "citation", attrs: { sourceId: "a" } },
        { type: "citation", attrs: { sourceId: "b" } },
        { type: "citation", attrs: { sourceId: "a" } },
        { type: "figure", attrs: { id: "f", caption: "Imagem" } },
        {
          type: "acronym",
          attrs: { short: "TCC", expansion: "Trabalho de Conclusão de Curso" },
        },
      ],
    };
    const r = analisar(doc);
    expect(r.labels.get("s2")).toBe("1.1");
    expect(r.labels.get("f")).toBe("Figura 1");
    expect(r.citations).toEqual(["a", "b"]);
    expect(renderDocumento(doc)).toContain("Introdução");
  });
});
const mod = (
  id: string,
  dependencies?: Record<string, number>,
  versao = 1,
) => ({
  manifesto: {
    id,
    nome: id,
    versao,
    apiVersion: 1 as const,
    capacidades: [],
    dependencias: dependencies,
  },
});
describe("contratos de módulos", () => {
  it("ordena dependências", () =>
    expect(
      ordenarModulos([mod("b", { a: 1 }), mod("a")]).map((m) => m.manifesto.id),
    ).toEqual(["a", "b"]));
  it.each([
    [mod("a"), mod("a")],
    [mod("a", { missing: 1 })],
    [mod("a", { b: 1 }), mod("b", { a: 1 })],
    [mod("a", { b: 2 }), mod("b")],
  ])("rejeita configuração inválida", (...mods) =>
    expect(() => ordenarModulos(mods)).toThrow(),
  );
  it("callbacks mutam a mesma lista, em ordem, e cancelam inscrição", () => {
    const reg = new RegistroDeModulos(
      createRouter({ history: createMemoryHistory(), routes: [] }),
    );
    const list: Contribuicao[] = [];
    reg.escutarEvento("listarBotoesDeLogin", (xs) => {
      expect(xs).toBe(list);
      xs.push({ id: "a", proprietario: "a", rotulo: "A" });
    });
    const cancel = reg.escutarEvento("listarBotoesDeLogin", (xs) => {
      xs.push({ id: "b", proprietario: "b", rotulo: "B" });
    });
    reg.dispararEvento("listarBotoesDeLogin", [list]);
    expect(list.map((x) => x.id)).toEqual(["a", "b"]);
    cancel();
    list.length = 0;
    reg.dispararEvento("listarBotoesDeLogin", [list]);
    expect(list).toHaveLength(1);
  });
  it("registra tela e detecta colisões", () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [] });
    const r = new RegistroDeModulos(router);
    r.registrarTela("/teste", {});
    expect(router.getRoutes().some((x) => x.path === "/teste")).toBe(true);
    expect(() => r.registrarTela("/teste", {})).toThrow();
  });
});
describe("autosave", () => {
  afterEach(() => vi.useRealTimers());
  it("salva após dois segundos de inatividade", async () => {
    vi.useFakeTimers();
    const send = vi.fn(async () => {}),
      a = new Autosave(
        () => 1,
        send,
        () => {},
        () => {},
      );
    a.dirty();
    await vi.advanceTimersByTimeAsync(1999);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledOnce();
    expect(a.unsaved).toBe(false);
    a.destroy();
  });
  it("digitação contínua salva em no máximo quinze segundos", async () => {
    vi.useFakeTimers();
    const send = vi.fn(async () => {}),
      a = new Autosave(
        () => 1,
        send,
        () => {},
        () => {},
      );
    for (let i = 0; i < 16; i++) {
      a.dirty();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(send).toHaveBeenCalled();
    a.destroy();
  });
  it("resposta atrasada não limpa edição posterior e serializa envios", async () => {
    let value = 1,
      release!: () => void;
    const sent: number[] = [];
    const a = new Autosave(
      () => value,
      async (snapshot) => {
        sent.push(snapshot);
        if (snapshot === 1) await new Promise<void>((r) => (release = r));
      },
      () => {},
      () => {},
    );
    a.dirty();
    const pending = a.flush();
    value = 2;
    a.dirty();
    expect(a.unsaved).toBe(true);
    release();
    await pending;
    expect(sent).toEqual([1, 2]);
    expect(a.unsaved).toBe(false);
    a.destroy();
  });
  it("409 suspende reenvio até conciliação explícita", async () => {
    const send = vi.fn(async () => {
        throw { status: 409 };
      }),
      a = new Autosave(
        () => 1,
        send,
        () => {},
        () => {},
      );
    a.dirty();
    expect(await a.flush()).toBe(false);
    a.dirty();
    await a.flush();
    expect(send).toHaveBeenCalledOnce();
    expect(a.unsaved).toBe(true);
    expect(a.paused).toBe(true);
    a.destroy();
  });
  it("falha de rede conserva estado sujo", async () => {
    const a = new Autosave(
      () => 1,
      async () => {
        throw new Error("offline");
      },
      () => {},
      () => {},
    );
    a.dirty();
    await a.flush();
    expect(a.status).toBe("Erro ao salvar");
    expect(a.unsaved).toBe(true);
    a.destroy();
  });
});

it("validação rejeita estrutura incompatível, versão desconhecida e marcas nulas", () => {
  for (const doc of [
    { type: "doc", schemaVersion: 2 },
    { type: "doc", content: [{ type: "text", text: "sem parágrafo" }] },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [null] }],
        },
      ],
    },
  ])
    expect(() => validarDocumento(doc)).toThrow();
});

it("preserva nós de extensão em blocos e dentro de parágrafos sem descartá-los", async () => {
  const { documentoCompativel } =
    await import("../../packages/shared/src/index.js");
  const inline = {
      type: "citacao-especial",
      attrs: { conteudo: "preservado" },
    },
    block = { type: "grafico-especial", attrs: { dados: [1, 2] } };
  const doc = documentoCompativel({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Antes " },
          inline,
          { type: "text", text: " depois" },
        ],
      },
      block,
    ],
  });
  expect(doc.content![0].content![1]).toEqual({
    type: "opaqueInline",
    attrs: { original: inline, label: "Extensão indisponível" },
  });
  expect(doc.content![1].attrs?.original).toEqual(block);
  expect(() => validarDocumento(doc)).not.toThrow();
});
