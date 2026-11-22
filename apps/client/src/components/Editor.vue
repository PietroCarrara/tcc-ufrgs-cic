<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Node, Mark, mergeAttributes } from "@tiptap/core";
import { TableKit, Table } from "@tiptap/extension-table";
import UniqueID from "@tiptap/extension-unique-id";
import {
  type RichText,
  type RichNode,
  type FonteDTO,
  type ArquivoDTO,
  percorrer,
  documentoCompativel,
} from "../../../../packages/shared/src/index.js";
import { analisar } from "../../../../packages/shared/src/render.js";
const props = defineProps<{
  modelValue: RichText;
  limited?: boolean;
  fontes?: FonteDTO[];
  arquivos?: ArquivoDTO[];
  projectId?: string;
  label?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [doc: RichText] }>();
const insertType = ref(""),
  sourceId = ref(""),
  locator = ref(""),
  fileId = ref(""),
  caption = ref(""),
  alt = ref(""),
  short = ref(""),
  expansion = ref(""),
  targetId = ref(""),
  tableCaption = ref("");
function academic(
  name: string,
  inline: boolean,
  attrs: Record<string, unknown>,
) {
  return Node.create({
    name,
    group: inline ? "inline" : "block",
    inline,
    atom: true,
    draggable: !inline,
    addAttributes() {
      return Object.fromEntries(
        Object.entries(attrs).map(([key, value]) => [key, { default: value }]),
      );
    },
    parseHTML() {
      return [{ tag: `${inline ? "span" : "div"}[data-node="${name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        inline ? "span" : "div",
        mergeAttributes(HTMLAttributes, { "data-node": name }),
        name,
      ];
    },
    addNodeView() {
      return ({ node, editor }) => {
        let current = node;
        const dom = document.createElement(inline ? "span" : "figure");
        dom.className = `academic-node ${name}`;
        dom.contentEditable = "false";
        const render = () => {
          const a = current.attrs,
            info = analisar(editor.getJSON() as RichNode);
          dom.replaceChildren();
          if (name === "figure") {
            const img = document.createElement("img");
            img.src = `/api/projetos/${props.projectId}/arquivos/${a.fileId}?inline=1`;
            img.alt = a.alt;
            const cap = document.createElement("figcaption");
            cap.textContent = `${info.labels.get(a.id) ?? "Figura"} — ${a.caption}`;
            dom.append(img, cap);
          } else if (name === "citation")
            dom.textContent = `[${info.citations.indexOf(a.sourceId) + 1}${a.locator ? ", " + a.locator : ""}]`;
          else if (name === "acronym")
            dom.textContent = `${a.expansion} (${a.short})`;
          else if (name === "internalReference")
            dom.textContent =
              info.labels.get(a.targetId) ?? "Referência sem destino";
          else
            dom.textContent =
              "Elemento de extensão indisponível · conteúdo preservado";
        };
        editor.on("transaction", render);
        render();
        return {
          dom,
          update(next) {
            if (next.type !== current.type) return false;
            current = next;
            render();
            return true;
          },
          destroy() {
            editor.off("transaction", render);
          },
        };
      };
    },
  });
}
const directQuote = Mark.create({
  name: "directQuote",
  parseHTML() {
    return [{ tag: "q" }];
  },
  renderHTML() {
    return ["q", 0];
  },
});
const allowed = new Set([
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
const hasOpaque = computed(() => {
  let found = false;
  percorrer(props.modelValue, (n) => {
    if (
      n.type === "opaque" ||
      n.type === "opaqueInline" ||
      !allowed.has(n.type)
    )
      found = true;
  });
  return found;
});
const editor = useEditor({
  content: documentoCompativel(props.modelValue),
  editorProps: {
    attributes: {
      class: "writing-surface",
      role: "textbox",
      "aria-label": props.label ?? "Texto do projeto",
      "aria-multiline": "true",
    },
  },
  extensions: [
    StarterKit.configure({
      heading: props.limited ? false : { levels: [1, 2, 3] },
      codeBlock: false,
      code: false,
      link: {
        openOnClick: false,
        protocols: ["https", "http"],
        isAllowedUri: (url) => /^https?:\/\//i.test(url),
      },
      trailingNode: false,
    }),
    directQuote,
    ...(props.limited
      ? []
      : [
          TableKit.configure({ table: false }),
          Table.extend({
            addAttributes() {
              return {
                ...this.parent?.(),
                id: { default: null },
                caption: { default: "" },
              };
            },
            renderHTML({ HTMLAttributes }) {
              const { caption, ...attributes } = HTMLAttributes;
              return [
                "table",
                attributes,
                ["caption", String(caption ?? "")],
                ["tbody", 0],
              ];
            },
          }),
          UniqueID.configure({ types: ["heading", "figure", "table"] }),
          academic("citation", true, { sourceId: "", locator: "" }),
          academic("figure", false, {
            id: null,
            fileId: "",
            caption: "",
            alt: "",
          }),
          academic("acronym", true, { short: "", expansion: "" }),
          academic("internalReference", true, { targetId: "" }),
          academic("opaque", false, { original: null, label: "" }),
          academic("opaqueInline", true, { original: null, label: "" }),
        ]),
  ],
  onUpdate({ editor }) {
    emit("update:modelValue", {
      ...editor.getJSON(),
      type: "doc",
      schemaVersion: 1,
    });
  },
});
watch(
  () => props.modelValue,
  (v) => {
    if (
      editor.value &&
      JSON.stringify(editor.value.getJSON()) !==
        JSON.stringify({ ...v, schemaVersion: undefined })
    )
      editor.value.commands.setContent(documentoCompativel(v), {
        emitUpdate: false,
      });
  },
  { deep: false },
);
const targets = computed(() => {
  const result: { id: string; text: string }[] = [];
  const info = analisar(props.modelValue);
  percorrer(props.modelValue, (n) => {
    if (n.attrs?.id && info.labels.has(String(n.attrs.id)))
      result.push({
        id: String(n.attrs.id),
        text: info.labels.get(String(n.attrs.id))!,
      });
  });
  return result;
});
function insert() {
  const e = editor.value;
  if (!e) return;
  const a = insertType.value;
  if (a === "citation")
    e.chain()
      .focus()
      .insertContent({
        type: a,
        attrs: { sourceId: sourceId.value, locator: locator.value },
      })
      .run();
  if (a === "figure")
    e.chain()
      .focus()
      .insertContent({
        type: a,
        attrs: {
          id: crypto.randomUUID(),
          fileId: fileId.value,
          caption: caption.value,
          alt: alt.value,
        },
      })
      .run();
  if (a === "acronym")
    e.chain()
      .focus()
      .insertContent({
        type: a,
        attrs: { short: short.value, expansion: expansion.value },
      })
      .run();
  if (a === "internalReference")
    e.chain()
      .focus()
      .insertContent({ type: a, attrs: { targetId: targetId.value } })
      .run();
  if (a === "table")
    e.chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .updateAttributes("table", { caption: tableCaption.value })
      .run();
  insertType.value = "";
}
onBeforeUnmount(() => editor.value?.destroy());
</script>
<template>
  <div v-if="editor" class="editor-wrapper">
    <div class="editor-toolbar" role="toolbar" aria-label="Formatação do texto">
      <button
        type="button"
        title="Negrito"
        aria-label="Negrito"
        :aria-pressed="editor.isActive('bold')"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <b>B</b></button
      ><button
        type="button"
        title="Itálico"
        aria-label="Itálico"
        :aria-pressed="editor.isActive('italic')"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <i>I</i></button
      ><button
        type="button"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        • Lista</button
      ><button
        type="button"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        1. Lista</button
      ><button
        type="button"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        ❝ Bloco</button
      ><button
        type="button"
        @click="editor.chain().focus().toggleMark('directQuote').run()"
      >
        “Citação”</button
      ><template v-if="!limited">
        <button
          v-for="level in [1, 2, 3] as const"
          :key="level"
          type="button"
          :aria-label="`Seção nível ${level}`"
          @click="editor.chain().focus().toggleHeading({ level }).run()"
        >
          H{{ level }}</button
        ><button
          v-for="[type, actionLabel] in [
            ['citation', 'Fonte'],
            ['figure', 'Figura'],
            ['table', 'Tabela'],
            ['acronym', 'Sigla'],
            ['internalReference', 'Referência interna'],
          ]"
          :key="type"
          type="button"
          @click="insertType = type"
        >
          + {{ actionLabel }}</button
        ><template v-if="editor.isActive('table')">
          <button
            type="button"
            @click="editor.chain().focus().addRowAfter().run()"
          >
            + Linha</button
          ><button
            type="button"
            @click="editor.chain().focus().addColumnAfter().run()"
          >
            + Coluna</button
          ><button
            type="button"
            @click="editor.chain().focus().deleteRow().run()"
          >
            − Linha</button
          ><button
            type="button"
            @click="editor.chain().focus().deleteColumn().run()"
          >
            − Coluna</button
          ><button
            type="button"
            @click="editor.chain().focus().deleteTable().run()"
          >
            Excluir tabela
          </button>
        </template> </template
      ><button
        type="button"
        aria-label="Desfazer"
        @click="editor.chain().focus().undo().run()"
      >
        ↶</button
      ><button
        type="button"
        aria-label="Refazer"
        @click="editor.chain().focus().redo().run()"
      >
        ↷
      </button>
    </div>
    <p v-if="hasOpaque" class="notice">
      Este documento contém elementos de uma extensão indisponível. Eles serão
      preservados ao salvar.
    </p>
    <form v-if="insertType" class="insert-form" @submit.prevent="insert">
      <template v-if="insertType === 'citation'">
        <label
          >Fonte<select v-model="sourceId" required>
            <option value="">Selecione uma fonte cadastrada</option>
            <option v-for="f in fontes" :key="f.id" :value="f.id">
              {{ f.titulo }}
            </option>
          </select></label
        ><label
          >Localizador (opcional)<input v-model="locator" placeholder="p. 12"
        /></label> </template
      ><template v-if="insertType === 'figure'">
        <label
          >Imagem anexada<select v-model="fileId" required>
            <option value="">Selecione uma imagem em Arquivos</option>
            <option
              v-for="f in arquivos?.filter((f) => f.mime.startsWith('image/'))"
              :key="f.id"
              :value="f.id"
            >
              {{ f.nome }}
            </option>
          </select></label
        ><label>Legenda<input v-model="caption" required /></label
        ><label
          >Texto alternativo<input v-model="alt" required
        /></label> </template
      ><template v-if="insertType === 'table'">
        <label
          >Legenda da tabela<input v-model="tableCaption" required
        /></label>
        <p>
          Comece com 3 × 3 células. Use os controles para adicionar linhas e
          colunas.
        </p> </template
      ><template v-if="insertType === 'acronym'">
        <label>Sigla<input v-model="short" required /></label
        ><label
          >Expansão<input v-model="expansion" required
        /></label> </template
      ><label v-if="insertType === 'internalReference'"
        >Elemento de destino<select v-model="targetId" required>
          <option value="">Selecione</option>
          <option v-for="t in targets" :key="t.id" :value="t.id">
            {{ t.text }}
          </option>
        </select></label
      >
      <div class="row">
        <button>Inserir</button
        ><button type="button" class="secondary" @click="insertType = ''">
          Cancelar
        </button>
      </div>
    </form>
    <EditorContent :editor="editor" />
  </div>
</template>
