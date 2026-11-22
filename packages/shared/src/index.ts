import { z } from "zod";
export type Papel = "aluno" | "professor";
export interface User {
  id: string;
  nome: string;
  email?: string;
  papel: Papel;
  foto?: boolean;
}
export interface RichNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
}
export interface RichText extends RichNode {
  type: "doc";
  schemaVersion?: 1;
}
export const vazio = (): RichText => ({
  type: "doc",
  schemaVersion: 1,
  content: [{ type: "paragraph" }],
});
export const textoDoc = (text: string): RichText => ({
  type: "doc",
  schemaVersion: 1,
  content: [
    {
      type: "paragraph",
      ...(text ? { content: [{ type: "text", text }] } : {}),
    },
  ],
});
export function textoVisivel(n: RichNode): string {
  return [n.text ?? "", ...(n.content ?? []).map(textoVisivel)].join(" ");
}
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export const sobrepoe = (a: Intervalo, b: Intervalo) =>
  a.dia === b.dia && a.inicio < b.fim && b.inicio < a.fim;
export const dias = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export const horario = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
export const uuid = z.string().uuid();
export const versao = z.number().int().positive();
export const intervaloSchema = z
  .object({
    dia: z.number().int().min(0).max(6),
    inicio: z.number().int().min(0).max(1425).multipleOf(15),
    fim: z.number().int().min(15).max(1440).multipleOf(15),
    descricao: z.string().trim().min(1).max(2000),
  })
  .refine((v) => v.inicio < v.fim, {
    message:
      "O fim deve ser após o início. Divida atividades que atravessam meia-noite.",
    path: ["fim"],
  });
export type Intervalo = z.infer<typeof intervaloSchema>;
export interface AtividadeDTO extends Intervalo {
  id: string;
  versao: number;
  projeto_id: string | null;
  usuario_id: string | null;
  projeto_titulo?: string;
}
export interface FonteDTO {
  id: string;
  projeto_id: string;
  titulo: string;
  autores: string[];
  link: string | null;
  publicacao: string | null;
  doi: string | null;
  provedor: string | null;
  externo_id: string | null;
  bibtex: string;
  versao: number;
}
export interface ArquivoDTO {
  id: string;
  nome: string;
  mime: string;
  tamanho: number;
}
export interface ProjetoDTO {
  id: string;
  titulo: string;
  tituloIngles: string;
  resumo: RichText;
  resumoIngles: RichText;
  palavrasChave: string[];
  palavrasChaveIngles: string[];
  texto: RichText;
  versao: number;
  membros: User[];
}
export interface Collection<T> {
  itens: T[];
  total: number;
  pagina: number;
  limite: number;
}
export const httpUrl = z
  .string()
  .max(2048)
  .url()
  .refine((s) => /^https?:\/\//i.test(s), "Use uma URL HTTP ou HTTPS");
export const fonteSchema = z.object({
  titulo: z.string().trim().min(1).max(1000),
  autores: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
  link: httpUrl.nullable().optional(),
  publicacao: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .refine((v) => {
      const [y, m, d] = v.split("-").map(Number);
      return (
        y >= 1 &&
        (m === undefined || (m >= 1 && m <= 12)) &&
        (d === undefined ||
          (d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate()))
      );
    }, "Data de publicação inválida")
    .nullable()
    .optional(),
  doi: z.string().trim().max(300).nullable().optional(),
  provedor: z.string().max(100).nullable().optional(),
  externo_id: z.string().max(300).nullable().optional(),
  bibtex: z.string().max(100000).default(""),
  permitirSemelhante: z.boolean().optional(),
});
export const loginSchema = z.object({
  email: z.email().max(254),
  senha: z.string().min(1).max(128),
});
export const propostaSchema = z.object({
  professorId: uuid,
  titulo: z.string().trim().min(1).max(300),
  descricao: z.string().trim().min(1).max(10000),
});
export class AppError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    message: string,
    public detalhes?: unknown,
  ) {
    super(message);
  }
}
export function exigir(
  cond: unknown,
  status: number,
  codigo: string,
  message: string,
  detalhes?: unknown,
): asserts cond {
  if (!cond) throw new AppError(status, codigo, message, detalhes);
}
export function percorrer(n: RichNode, cb: (node: RichNode) => void) {
  cb(n);
  for (const child of n.content ?? []) percorrer(child, cb);
}
const nodes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "horizontalRule",
  "citation",
  "figure",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "acronym",
  "internalReference",
  "opaque",
  "opaqueInline",
]);
const markTypes = new Set([
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
  "link",
  "directQuote",
]);
export function validarDocumento(value: unknown, limited = false): RichText {
  exigir(
    !!value && typeof value === "object",
    400,
    "DOCUMENTO_INVALIDO",
    "Documento inválido",
  );
  let count = 0;
  const ids = new Set<string>();
  const walk = (raw: unknown, depth: number) => {
    exigir(
      depth < 40 && ++count < 30000,
      400,
      "DOCUMENTO_INVALIDO",
      "Documento excessivamente complexo",
    );
    exigir(
      !!raw && typeof raw === "object" && !Array.isArray(raw),
      400,
      "DOCUMENTO_INVALIDO",
      "Nó inválido",
    );
    const n = raw as RichNode;
    const nodeKeys = [
      "type",
      "text",
      "attrs",
      "marks",
      "content",
      ...(depth === 0 ? ["schemaVersion"] : []),
    ];
    exigir(
      Object.keys(raw).every((key) => nodeKeys.includes(key)),
      400,
      "DOCUMENTO_INVALIDO",
      "Campo de nó desconhecido",
    );
    if (depth === 0)
      exigir(
        (raw as RichText).schemaVersion === undefined ||
          (raw as RichText).schemaVersion === 1,
        400,
        "DOCUMENTO_INVALIDO",
        "Versão do documento incompatível",
      );
    exigir(
      typeof n.type === "string" && nodes.has(n.type),
      400,
      "DOCUMENTO_INVALIDO",
      "Tipo de nó não permitido",
    );
    if (limited)
      exigir(
        [
          "doc",
          "paragraph",
          "text",
          "bulletList",
          "orderedList",
          "listItem",
          "blockquote",
          "hardBreak",
        ].includes(n.type),
        400,
        "DOCUMENTO_INVALIDO",
        "Elemento indisponível neste campo",
      );
    exigir(
      n.text === undefined ||
        (typeof n.text === "string" && n.text.length <= 100000),
      400,
      "DOCUMENTO_INVALIDO",
      "Texto inválido",
    );
    exigir(
      n.attrs === undefined ||
        (typeof n.attrs === "object" &&
          n.attrs !== null &&
          !Array.isArray(n.attrs)),
      400,
      "DOCUMENTO_INVALIDO",
      "Atributos inválidos",
    );
    const a = n.attrs ?? {};
    const allowed: Record<string, string[]> = {
      heading: ["level", "id"],
      paragraph: ["id"],
      figure: ["id", "fileId", "caption", "alt"],
      citation: ["sourceId", "locator"],
      acronym: ["short", "expansion"],
      internalReference: ["targetId"],
      table: ["id", "caption"],
      tableCell: ["colspan", "rowspan", "colwidth", "align"],
      tableHeader: ["colspan", "rowspan", "colwidth", "align"],
      orderedList: ["start", "type"],
      opaque: ["original", "label"],
      opaqueInline: ["original", "label"],
    };
    for (const key of Object.keys(a))
      exigir(
        (allowed[n.type] ?? []).includes(key),
        400,
        "DOCUMENTO_INVALIDO",
        `Atributo não permitido: ${key}`,
      );
    if (a.id != null) {
      exigir(
        typeof a.id === "string" && a.id.length <= 100 && !ids.has(a.id),
        400,
        "DOCUMENTO_INVALIDO",
        "Identificador de elemento duplicado ou inválido",
      );
      ids.add(a.id);
    }
    if (n.type === "heading")
      exigir(
        [1, 2, 3].includes(Number(a.level)),
        400,
        "DOCUMENTO_INVALIDO",
        "Nível de seção inválido",
      );
    for (const key of ["sourceId", "fileId"])
      if (a[key] !== undefined) uuid.parse(a[key]);
    for (const key of [
      "caption",
      "alt",
      "locator",
      "short",
      "expansion",
      "targetId",
      "label",
    ])
      if (a[key] !== undefined)
        exigir(
          typeof a[key] === "string" && (a[key] as string).length <= 2000,
          400,
          "DOCUMENTO_INVALIDO",
          "Atributo de texto inválido",
        );
    if (n.type === "opaque" || n.type === "opaqueInline")
      exigir(
        a.original && typeof a.original === "object",
        400,
        "DOCUMENTO_INVALIDO",
        "Conteúdo opaco inválido",
      );
    for (const key of ["colspan", "rowspan"])
      if (a[key] !== undefined)
        exigir(
          Number.isInteger(a[key]) &&
            Number(a[key]) >= 1 &&
            Number(a[key]) <= 100,
          400,
          "DOCUMENTO_INVALIDO",
          "Dimensão de célula inválida",
        );
    if (a.align != null)
      exigir(
        ["left", "center", "right", "justify"].includes(String(a.align)),
        400,
        "DOCUMENTO_INVALIDO",
        "Alinhamento inválido",
      );
    if (a.colwidth != null)
      exigir(
        Array.isArray(a.colwidth) &&
          a.colwidth.every((x) => Number.isInteger(x) && x > 0 && x < 5000),
        400,
        "DOCUMENTO_INVALIDO",
        "Largura inválida",
      );
    const blocks = [
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "blockquote",
      "horizontalRule",
      "figure",
      "table",
      "opaque",
    ];
    const inline = [
      "text",
      "hardBreak",
      "citation",
      "acronym",
      "internalReference",
      "opaqueInline",
    ];
    const children: Record<string, string[]> = {
      doc: blocks,
      paragraph: inline,
      heading: inline,
      blockquote: blocks,
      bulletList: ["listItem"],
      orderedList: ["listItem"],
      listItem: blocks,
      table: ["tableRow"],
      tableRow: ["tableCell", "tableHeader"],
      tableCell: blocks,
      tableHeader: blocks,
    };
    if (n.content !== undefined)
      exigir(
        Array.isArray(n.content) &&
          n.content.every(
            (child) =>
              !!child &&
              typeof child === "object" &&
              (children[n.type] ?? []).includes(child.type),
          ),
        400,
        "DOCUMENTO_INVALIDO",
        "Estrutura de documento inválida",
      );
    if (n.type === "text")
      exigir(
        typeof n.text === "string" && n.text.length > 0,
        400,
        "DOCUMENTO_INVALIDO",
        "Nó de texto vazio",
      );
    else
      exigir(
        n.text === undefined,
        400,
        "DOCUMENTO_INVALIDO",
        "Texto fora de nó textual",
      );
    if (n.type === "acronym")
      exigir(
        typeof a.short === "string" &&
          a.short.trim() &&
          typeof a.expansion === "string" &&
          a.expansion.trim(),
        400,
        "DOCUMENTO_INVALIDO",
        "Informe a sigla e sua expansão",
      );
    if (n.marks) {
      exigir(
        Array.isArray(n.marks),
        400,
        "DOCUMENTO_INVALIDO",
        "Marcas inválidas",
      );
      for (const m of n.marks) {
        exigir(
          !!m && typeof m === "object" && markTypes.has(m.type),
          400,
          "DOCUMENTO_INVALIDO",
          "Marca inválida",
        );
        if (m.type === "link") httpUrl.parse(m.attrs?.href);
        else
          exigir(
            !m.attrs || Object.keys(m.attrs).length === 0,
            400,
            "DOCUMENTO_INVALIDO",
            "Atributos de marca inválidos",
          );
      }
    }
    if (n.content) {
      exigir(
        Array.isArray(n.content),
        400,
        "DOCUMENTO_INVALIDO",
        "Conteúdo inválido",
      );
      for (const c of n.content) walk(c, depth + 1);
    }
  };
  walk(value, 0);
  exigir(
    (value as RichNode).type === "doc",
    400,
    "DOCUMENTO_INVALIDO",
    "Raiz deve ser doc",
  );
  return { ...(value as RichText), schemaVersion: 1 };
}
export const richSchema = z.unknown().transform((v) => validarDocumento(v));
export const limitedRichSchema = z
  .unknown()
  .transform((v) => validarDocumento(v, true));
export const projetoSchema = z.object({
  versao,
  titulo: z.string().trim().min(1).max(300),
  tituloIngles: z.string().max(300).default(""),
  resumo: limitedRichSchema,
  resumoIngles: limitedRichSchema,
  palavrasChave: z.array(z.string().max(100)).max(30),
  palavrasChaveIngles: z.array(z.string().max(100)).max(30),
  texto: richSchema,
});
export interface Manifesto {
  id: string;
  nome: string;
  versao: number;
  apiVersion: 1;
  dependencias?: Record<string, number>;
  capacidades: string[];
}
export function ordenarModulos<T extends { manifesto: Manifesto }>(
  mods: T[],
): T[] {
  const map = new Map<string, T>();
  for (const m of mods) {
    const a = m.manifesto;
    exigir(
      /^[a-z][a-z0-9-]*$/.test(a.id) &&
        a.apiVersion === 1 &&
        Number.isInteger(a.versao) &&
        a.versao > 0,
      500,
      "MODULO_INVALIDO",
      `Manifesto incompatível: ${a.id}`,
    );
    exigir(!map.has(a.id), 500, "MODULO_DUPLICADO", `ID duplicado: ${a.id}`);
    map.set(a.id, m);
  }
  const done = new Set<string>(),
    visiting = new Set<string>(),
    out: T[] = [];
  const visit = (m: T) => {
    const id = m.manifesto.id;
    if (done.has(id)) return;
    exigir(!visiting.has(id), 500, "CICLO_MODULOS", `Ciclo: ${id}`);
    visiting.add(id);
    for (const [dep, min] of Object.entries(m.manifesto.dependencias ?? {})) {
      const d = map.get(dep);
      exigir(
        d && d.manifesto.versao >= min,
        500,
        "DEPENDENCIA_MODULO",
        `${id} exige ${dep} versão >= ${min}`,
      );
      visit(d);
    }
    visiting.delete(id);
    done.add(id);
    out.push(m);
  };
  mods.forEach(visit);
  return out;
}

/** Mantém a posição estrutural de elementos de extensões ausentes. */
export function documentoCompativel(n: RichNode, inline = false): RichNode {
  if (!nodes.has(n.type))
    return {
      type: inline ? "opaqueInline" : "opaque",
      attrs: { original: n, label: "Extensão indisponível" },
    };
  return {
    ...n,
    ...(n.content
      ? {
          content: n.content.map((child) =>
            documentoCompativel(
              child,
              ["paragraph", "heading"].includes(n.type),
            ),
          ),
        }
      : {}),
  };
}
