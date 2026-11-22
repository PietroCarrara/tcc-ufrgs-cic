import {
  type RichNode,
  type FonteDTO,
  type ProjetoDTO,
  percorrer,
} from "./index.js";
export const escapeHtml = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function analisar(doc: RichNode) {
  const citations: string[] = [],
    labels = new Map<string, string>(),
    siglas = new Map<string, string>();
  let figura = 0,
    tabela = 0;
  const levels = [0, 0, 0];
  percorrer(doc, (n) => {
    const a = n.attrs ?? {};
    if (n.type === "citation" && !citations.includes(String(a.sourceId)))
      citations.push(String(a.sourceId));
    if (n.type === "acronym") siglas.set(String(a.short), String(a.expansion));
    let label = "";
    if (n.type === "heading") {
      const l = Number(a.level) - 1;
      levels[l]++;
      for (let i = l + 1; i < 3; i++) levels[i] = 0;
      label = levels.slice(0, l + 1).join(".");
    }
    if (n.type === "figure") label = `Figura ${++figura}`;
    if (n.type === "table") label = `Tabela ${++tabela}`;
    if (label && a.id) labels.set(String(a.id), label);
  });
  return { citations, labels, siglas };
}
export function renderDocumento(
  doc: RichNode,
  fontes: FonteDTO[] = [],
  imageUrl: (id: string) => string = () => "",
  includeLists = true,
) {
  const info = analisar(doc),
    seen = new Set<string>();
  const esc = escapeHtml;
  const render = (n: RichNode): string => {
    const a = n.attrs ?? {},
      content = () => (n.content ?? []).map(render).join("");
    if (n.type === "text") {
      let text = esc(n.text);
      for (const m of n.marks ?? []) {
        const tag = (
          {
            bold: "strong",
            italic: "em",
            strike: "s",
            underline: "u",
            code: "code",
            directQuote: "q",
          } as Record<string, string>
        )[m.type];
        if (tag) text = `<${tag}>${text}</${tag}>`;
        if (m.type === "link" && /^https?:\/\//.test(String(m.attrs?.href)))
          text = `<a href="${esc(m.attrs?.href)}" rel="noopener noreferrer">${text}</a>`;
      }
      return text;
    }
    const tags: Record<string, string> = {
      doc: "div",
      paragraph: "p",
      bulletList: "ul",
      orderedList: "ol",
      listItem: "li",
      blockquote: "blockquote",
      tableRow: "tr",
      tableCell: "td",
      tableHeader: "th",
    };
    if (tags[n.type]) {
      const t = tags[n.type];
      return `<${t}${["td", "th"].includes(t) ? ` colspan="${Number(a.colspan) || 1}" rowspan="${Number(a.rowspan) || 1}"` : ""}>${content()}</${t}>`;
    }
    if (n.type === "heading")
      return `<h${a.level} id="${esc(a.id)}">${esc(info.labels.get(String(a.id)))} ${content()}</h${a.level}>`;
    if (n.type === "hardBreak") return "<br>";
    if (n.type === "horizontalRule") return "<hr>";
    if (n.type === "citation")
      return `<span>[${info.citations.indexOf(String(a.sourceId)) + 1}${a.locator ? `, ${esc(a.locator)}` : ""}]</span>`;
    if (n.type === "internalReference")
      return esc(
        info.labels.get(String(a.targetId)) ?? "Referência não encontrada",
      );
    if (n.type === "acronym") {
      const s = String(a.short),
        first = !seen.has(s);
      seen.add(s);
      return first ? `${esc(a.expansion)} (${esc(s)})` : esc(s);
    }
    if (n.type === "figure")
      return `<figure id="${esc(a.id)}"><img src="${esc(imageUrl(String(a.fileId)))}" alt="${esc(a.alt)}"><figcaption>${esc(info.labels.get(String(a.id)))} — ${esc(a.caption)}</figcaption></figure>`;
    if (n.type === "table") {
      const rows = n.content ?? [];
      const headers = rows[0]?.content?.every((c) => c.type === "tableHeader");
      return `<table id="${esc(a.id)}"><caption>${esc(info.labels.get(String(a.id)))} — ${esc(a.caption)}</caption>${headers ? `<thead>${render(rows[0])}</thead>` : ""}<tbody>${rows
        .slice(headers ? 1 : 0)
        .map(render)
        .join("")}</tbody></table>`;
    }
    return n.type === "opaqueInline"
      ? "<span>Elemento de extensão indisponível. Conteúdo preservado.</span>"
      : "<aside>Elemento de extensão indisponível. Conteúdo preservado.</aside>";
  };
  const html = render(doc);
  if (!includeLists) return html;
  const bib = info.citations
    .map((id, i) => {
      const f = fontes.find((x) => x.id === id);
      return f
        ? `<li value="${i + 1}">${esc(f.autores.join("; "))}. <strong>${esc(f.titulo)}</strong>. ${esc(f.publicacao ?? "Data desconhecida")}${f.link ? `. ${esc(f.link)}` : ""}</li>`
        : "<li>Fonte não encontrada</li>";
    })
    .join("");
  return `${html}${info.siglas.size ? `<h2>Lista de siglas</h2><dl>${[...info.siglas].map(([s, e]) => `<dt>${esc(s)}</dt><dd>${esc(e)}</dd>`).join("")}</dl>` : ""}${bib ? `<h2>Referências</h2><ol>${bib}</ol>` : ""}`;
}
export function renderProjeto(
  p: ProjetoDTO,
  fontes: FonteDTO[],
  imageUrl: (id: string) => string,
) {
  return `<header><h1>${escapeHtml(p.titulo)}</h1><p>${escapeHtml(p.tituloIngles)}</p><p>Autores: ${escapeHtml(
    p.membros
      .filter((m) => m.papel === "aluno")
      .map((m) => m.nome)
      .join(", "),
  )}</p><p>Orientadores: ${escapeHtml(
    p.membros
      .filter((m) => m.papel === "professor")
      .map((m) => m.nome)
      .join(", "),
  )}</p></header><h2>Resumo</h2>${renderDocumento(p.resumo, [], imageUrl, false)}<p>Palavras-chave: ${escapeHtml(p.palavrasChave.join("; "))}</p><h2>Abstract</h2>${renderDocumento(p.resumoIngles, [], imageUrl, false)}<p>Keywords: ${escapeHtml(p.palavrasChaveIngles.join("; "))}</p><main>${renderDocumento(p.texto, fontes, imageUrl)}</main>`;
}
