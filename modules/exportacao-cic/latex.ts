import {
  percorrer,
  type FonteDTO,
  type ProjetoDTO,
  type RichNode,
} from "../../packages/shared/src/index.js";
import { analisar } from "../../packages/shared/src/render.js";

const caracteresLatex: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "#": "\\#",
  $: "\\$",
  "%": "\\%",
  "&": "\\&",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
  '"': "\\textquotedbl{}",
  "'": "\\textquotesingle{}",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
  "|": "\\textbar{}",
  "`": "\\textasciigrave{}",
};

function texto(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .replace(/[\p{Cc}\p{Cs}]/gu, "")
    .replace(/[\\{}#$%&_~^"'<>|`]/g, (c) => caracteresLatex[c]);
}

function enderecoHex(value: unknown) {
  const url = URL.parse(String(value));
  return url && ["http:", "https:"].includes(url.protocol)
    ? Buffer.from(url.href).toString("hex")
    : undefined;
}

export function arquivosDeFiguras(projeto: ProjetoDTO) {
  const ids = new Set<string>();
  percorrer(projeto.texto, (node) => {
    if (node.type === "figure" && typeof node.attrs?.fileId === "string")
      ids.add(node.attrs.fileId);
  });
  return ids;
}

const comandosDeMarca: Record<string, string> = {
  bold: "textbf",
  italic: "textit",
  strike: "sout",
  underline: "uline",
  code: "texttt",
  directQuote: "enquote",
};

function textoComMarcas(node: RichNode) {
  let content = texto(node.text);
  for (const mark of node.marks ?? []) {
    const command = comandosDeMarca[mark.type];
    if (command) content = `\\${command}{${content}}`;
    if (mark.type === "link") {
      const url = enderecoHex(mark.attrs?.href);
      if (url) content = String.raw`\TramaHref{${url}}{${content}}`;
    }
  }
  return content;
}

const alinhamento: Record<string, string> = {
  left: "l",
  center: "c",
  right: "r",
  justify: "j",
};

function tabela(
  node: RichNode,
  legenda: string,
  referencia: string | undefined,
  renderCell: (cell: RichNode) => string,
  aninhada: boolean,
) {
  const rows = node.content ?? [];
  const label = referencia ? String.raw`\label{${referencia}}` : "";
  const caption = String.raw`\captionof{table}{${legenda}}${label}`;
  const ocupadasAte: number[] = [];
  const cells: string[][] = [];
  for (const [index, row] of rows.entries()) {
    const rendered: string[] = [];
    let col = 0;
    for (const cell of row.content ?? []) {
      const colspan = Number(cell.attrs?.colspan ?? 1);
      const rowspan = Math.min(
        Number(cell.attrs?.rowspan ?? 1),
        rows.length - index,
      );
      while (ocupadasAte.slice(col, col + colspan).some((end) => end > index))
        col++;
      if (col + colspan > 40) {
        // Mesmo com conteúdo curto, uma grade tão larga deixa as células ilegíveis em A4.
        const linhas = rows
          .map((row) => (row.content ?? []).map(renderCell).join("\n"))
          .join("\\smallskip\n");
        return caption + "\n" + linhas;
      }
      const align = alinhamento[String(cell.attrs?.align)] ?? "l";
      rendered[col] =
        String.raw`\SetCell[r=${rowspan},c=${colspan}]{${align}}{${renderCell(cell)}}`;
      for (let i = col; i < col + colspan; i++)
        ocupadasAte[i] = index + rowspan;
      col += colspan;
    }
    cells.push(rendered);
  }
  const columns = ocupadasAte.length;
  if (!columns) return caption;

  const header = rows[0]?.content;
  const repeatHeader = Boolean(
    header?.length &&
    header.every(
      (cell) =>
        cell.type === "tableHeader" && Number(cell.attrs?.rowspan ?? 1) === 1,
    ),
  );
  const options = String.raw`width=\linewidth,colspec={*{${columns}}{X[l]}},hline{1,Z}={}${repeatHeader ? ",hline{2}={}" : ""}`;
  const body = cells
    .map(
      (row) =>
        Array.from({ length: columns }, (_, col) => row[col] ?? "").join(
          " & ",
        ) + String.raw` \\`,
    )
    .join("\n");
  if (aninhada)
    return String.raw`${caption}
\begin{tblr}{${options}}
${body}
\end{tblr}\par
`;
  const tableLabel = referencia ? `,label={${referencia}}` : "";
  return String.raw`\begin{longtblr}[caption={${legenda}}${tableLabel}]{${options},rowhead=${Number(repeatHeader)}}
${body}
\end{longtblr}
`;
}

function renderDocumentoLatex(
  doc: RichNode,
  imagens: ReadonlyMap<string, string>,
  siglas: ReadonlyMap<string, { id: string; expansao: string }>,
) {
  const { citations, labels } = analisar(doc);
  const fontes = new Map(citations.map((id, i) => [id, `fonte-${i + 1}`]));
  const referencias = new Map(
    [...labels.keys()].map((id, i) => [id, `elemento-${i + 1}`]),
  );

  const render = (
    node: RichNode,
    dentroDaTabela = false,
    emTitulo = false,
  ): string => {
    const attrs = node.attrs ?? {};
    const children = () =>
      (node.content ?? [])
        .map((child) => render(child, dentroDaTabela, emTitulo))
        .join("");
    const referencia = referencias.get(String(attrs.id));
    const label = () => (referencia ? String.raw`\label{${referencia}}` : "");
    switch (node.type) {
      case "doc":
      case "tableCell":
      case "tableHeader":
        return children();
      case "paragraph":
        return String.raw`\leavevmode{}${children()}\par` + "\n";
      case "text":
        return textoComMarcas(node);
      case "heading": {
        const command = ["chapter", "section", "subsection"][
          Number(attrs.level) - 1
        ];
        const titulo = (node.content ?? [])
          .map((child) => render(child, dentroDaTabela, true))
          .join("");
        return `\\${command}{${titulo}}${label()}\n`;
      }
      case "hardBreak":
        return String.raw`\leavevmode\newline{}`;
      case "horizontalRule":
        return "\\par\\smallskip\\hrule\\smallskip\n";
      case "bulletList":
      case "orderedList": {
        if (!node.content?.length) return "";
        const env = node.type === "bulletList" ? "itemize" : "enumerate";
        const start = Number(attrs.start);
        const options =
          env === "enumerate" &&
          Number.isInteger(start) &&
          start > 1 &&
          start <= 1_000_000
            ? `[start=${start}]`
            : "";
        return String.raw`\begin{${env}}${options}
${children()}\end{${env}}
`;
      }
      case "listItem":
        return String.raw`\item{}${children()}` + "\n";
      case "blockquote":
        return String.raw`\begin{quote}
${children()}\end{quote}
`;
      case "citation": {
        const locator = attrs.locator ? `[{${texto(attrs.locator)}}]` : "";
        return String.raw`\cite${locator}{${fontes.get(String(attrs.sourceId))}}`;
      }
      case "internalReference": {
        const id = String(attrs.targetId);
        const destino = referencias.get(id);
        if (!destino) return "Referência não encontrada";
        const tipo = /^(Figura|Tabela) /.exec(labels.get(id) ?? "")?.[1];
        return String.raw`${tipo ? `${tipo}~` : ""}\ref{${destino}}`;
      }
      case "acronym": {
        const entry = siglas.get(String(attrs.short));
        if (!entry || emTitulo) return texto(attrs.short);
        return String.raw`\gls{${entry.id}}`;
      }
      case "figure": {
        const image = imagens.get(String(attrs.fileId));
        const figure = image
          ? String.raw`\includegraphics[width=\linewidth,height=.58\textheight,keepaspectratio]{${image}}`
          : String.raw`\textit{${texto(attrs.alt) || "Imagem indisponível"}}`;
        return String.raw`\par\noindent
\begin{minipage}{\linewidth}
\centering
${figure}\par
\captionof{figure}{${texto(attrs.caption)}}${label()}
\end{minipage}\par
`;
      }
      case "table":
        return tabela(
          node,
          texto(attrs.caption),
          referencia,
          (cell) => render(cell, true),
          dentroDaTabela,
        );
      case "opaqueInline":
        return "\\textit{Elemento de extensão indisponível. Conteúdo preservado.}";
      default:
        return "\\par\\textit{Elemento de extensão indisponível. Conteúdo preservado.}\\par\n";
    }
  };

  return render(doc);
}

export function renderBibliografiaLatex(
  projeto: ProjetoDTO,
  fontes: FonteDTO[],
) {
  const { citations } = analisar(projeto.texto);
  const fontesPorId = new Map(fontes.map((fonte) => [fonte.id, fonte]));
  return citations
    .map((id, i) => {
      const fonte = fontesPorId.get(id);
      const autores = fonte?.autores
        .map((nome) => {
          const [sobrenome, prenomes] = separarNome(nome);
          return prenomes
            ? `${texto(sobrenome)}, ${texto(prenomes)}`
            : texto(sobrenome);
        })
        .join(" and ");
      const url = enderecoHex(fonte?.link);
      const fields = [
        `title = {{${texto(fonte?.titulo ?? "Fonte não encontrada")}}}`,
        autores ? `author = {${autores}}` : "",
        `year = {${fonte?.publicacao ? texto(fonte.publicacao.slice(0, 4)) : "{s.d.}"}}`,
        url ? String.raw`note = {\TramaUrl{${url}}}` : "",
      ].filter(Boolean);
      return `@misc{fonte-${i + 1},\n  ${fields.join(",\n  ")}\n}`;
    })
    .join("\n\n");
}

function siglasDoProjeto(p: ProjetoDTO) {
  const siglas = new Map<string, { id: string; expansao: string }>();
  for (const doc of [p.resumo, p.resumoIngles, p.texto]) {
    for (const [curta, expansao] of analisar(doc).siglas) {
      siglas.set(curta, {
        id: siglas.get(curta)?.id ?? `sigla-${siglas.size + 1}`,
        expansao,
      });
    }
  }
  return siglas;
}

function separarNome(nome: string): [string, string] {
  const [sobrenome, ...prenomes] = nome.trim().split(/,\s+/);
  if (prenomes.length) return [sobrenome, prenomes.join(", ")];
  const partes = sobrenome.split(/\s+/);
  const ultimo = partes.pop() ?? "";
  return [ultimo, partes.join(" ")];
}

function pessoa(
  comando: "author" | "advisor",
  [sobrenome, prenomes]: [string, string],
) {
  return `\\${comando}{${texto(sobrenome)}}{${texto(prenomes)}}`;
}

function palavrasChave(
  comando: "keyword" | "translatedkeyword",
  valores: string[],
) {
  const palavras = valores.map((v) => v.trim()).filter(Boolean);
  const campos =
    palavras.length > 10
      ? [...palavras.slice(0, 9), palavras.slice(9).join(". ")]
      : palavras;
  return campos.map((palavra) => `\\${comando}{${texto(palavra)}}`);
}

export function renderPreProjetoLatex(p: ProjetoDTO) {
  const siglas = siglasDoProjeto(p);
  const autores = p.membros
    .filter((m) => m.papel === "aluno")
    .map((m) => m.nome);
  const orientadores = p.membros
    .filter((m) => m.papel === "professor")
    .map((m) => m.nome);
  const autoria = autores
    .slice(0, autores.length > 4 ? 3 : 4)
    .map((nome) => pessoa("author", separarNome(nome)));
  if (autores.length > 4)
    autoria.push(pessoa("author", ["", autores.slice(3).join(", ")]));
  const orientacao: [string, string] =
    orientadores.length === 1
      ? separarNome(orientadores[0])
      : ["", orientadores.join(", ")];
  return [
    siglas.size ? String.raw`\makeglossaries` : "",
    ...[...siglas].map(([curta, { id, expansao }]) => {
      const ordem = curta.normalize("NFD").replace(/[^a-z0-9]/gi, "");
      return String.raw`\newacronym[sort={${ordem}${id}}]{${id}}{${texto(curta)}}{${texto(expansao)}}`;
    }),
    String.raw`\title{${texto(p.titulo)}}`,
    String.raw`\translatedtitle{${texto(p.tituloIngles)}}`,
    ...(autoria.length ? autoria : [String.raw`\author{}{}`]),
    pessoa("advisor", orientacao),
    String.raw`\date{\monthname}{\number\year}`,
    ...palavrasChave("keyword", p.palavrasChave),
    ...palavrasChave("translatedkeyword", p.palavrasChaveIngles),
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderProjetoLatex(
  p: ProjetoDTO,
  imagens: ReadonlyMap<string, string>,
) {
  const siglas = siglasDoProjeto(p);
  const tipos = new Set<string>();
  percorrer(p.texto, (node) => tipos.add(node.type));
  return String.raw`\maketitle
\begin{abstract}
${renderDocumentoLatex(p.resumo, imagens, siglas)}
${p.palavrasChave.some((palavra) => palavra.trim()) ? String.raw`\leavevmode` : ""}
\end{abstract}
\glsresetall
\begin{translatedabstract}
${renderDocumentoLatex(p.resumoIngles, imagens, siglas)}
\end{translatedabstract}
\clearpage
\tableofcontents
${tipos.has("figure") ? String.raw`\clearpage\listoffigures` : ""}
${tipos.has("table") ? String.raw`\clearpage\listoftables` : ""}
${
  siglas.size
    ? String.raw`\glsaddall\clearpage
\printglossary[type=\acronymtype,title={Lista de Abreviaturas e Siglas}]
\glsresetall`
    : ""
}
\clearpage
${renderDocumentoLatex(p.texto, imagens, siglas)}
${
  tipos.has("citation")
    ? String.raw`\bibliographystyle{abntex2-alf}
\bibliography{referencias}`
    : ""
}
`;
}
