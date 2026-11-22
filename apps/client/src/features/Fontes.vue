<script setup lang="ts">
import { reactive, ref } from "vue";
import { enviar, ApiError } from "../core/http.js";
import type { FonteDTO } from "../../../../packages/shared/src/index.js";
const props = defineProps<{ projectId: string; items: FonteDTO[] }>(),
  emit = defineEmits<{ changed: [] }>();
const error = ref(""),
  success = ref(""),
  editing = ref<FonteDTO | null>(null),
  show = ref(false),
  bibtex = ref("");
const form = reactive({
  titulo: "",
  autores: "",
  link: "",
  publicacao: "",
  doi: "",
  provedor: null as string | null,
  externo_id: null as string | null,
  bibtex: "",
});
function open(f?: Partial<FonteDTO>) {
  editing.value = f?.id ? (f as FonteDTO) : null;
  Object.assign(form, {
    titulo: f?.titulo ?? "",
    autores: f?.autores?.join("; ") ?? "",
    link: f?.link ?? "",
    publicacao: f?.publicacao ?? "",
    doi: f?.doi ?? "",
    provedor: f?.provedor ?? null,
    externo_id: f?.externo_id ?? null,
    bibtex: f?.bibtex ?? "",
  });
  show.value = true;
}
async function save(permitirSemelhante = false) {
  error.value = "";
  try {
    await enviar(
      `/api/projetos/${props.projectId}/fontes${editing.value ? "/" + editing.value.id : ""}`,
      {
        ...form,
        autores: form.autores
          .split(";")
          .map((x) => x.trim())
          .filter(Boolean),
        link: form.link || null,
        publicacao: form.publicacao || null,
        doi: form.doi || null,
        versao: editing.value?.versao,
        permitirSemelhante,
      },
      editing.value ? "PATCH" : "POST",
    );
    show.value = false;
    success.value = "Fonte salva.";
    emit("changed");
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.codigo === "FONTE_SEMELHANTE" &&
      confirm("Já existe uma fonte semelhante. Cadastrar outra mesmo assim?")
    )
      return save(true);
    error.value = (e as Error).message;
  }
}
async function remove(f: FonteDTO) {
  if (!confirm(`Excluir “${f.titulo}”?`)) return;
  try {
    await enviar(
      `/api/projetos/${props.projectId}/fontes/${f.id}`,
      { versao: f.versao },
      "DELETE",
    );
    emit("changed");
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function importBib() {
  error.value = "";
  try {
    const r = await enviar(
      `/api/projetos/${props.projectId}/fontes/importar-bibtex`,
      { bibtex: bibtex.value },
    );
    success.value = `${r.itens.length} fontes importadas.`;
    bibtex.value = "";
    emit("changed");
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function readFile(event: Event) {
  const f = (event.target as HTMLInputElement).files?.[0];
  if (f) bibtex.value = await f.text();
}
function drop(event: DragEvent) {
  event.preventDefault();
  try {
    const f = JSON.parse(
      event.dataTransfer?.getData("application/x-trama-fonte") ?? "",
    );
    open(f);
  } catch {
    error.value = "Arraste um resultado da busca bibliográfica.";
  }
}
defineExpose({ open });
</script>
<template>
  <section class="sources-panel" @dragover.prevent @drop="drop">
    <div class="section-title">
      <h2>
        Fontes do projeto <small>({{ items.length }})</small>
      </h2>
      <button class="secondary" @click="open()">+ Fonte manual</button>
    </div>
    <p class="muted">
      Solte resultados da busca aqui ou cadastre uma fonte. Campos desconhecidos
      podem permanecer em branco.
    </p>
    <p v-if="error" class="alert" role="alert">{{ error }}</p>
    <p v-if="success" class="success" role="status">{{ success }}</p>
    <form v-if="show" class="card" @submit.prevent="save()">
      <h3>{{ editing ? "Editar fonte" : "Cadastrar fonte" }}</h3>
      <label
        >Título<input v-model="form.titulo" required maxlength="1000" /></label
      ><label
        >Autores, separados por ponto e vírgula<input v-model="form.autores"
      /></label>
      <div class="form-grid">
        <label
          >Publicação (AAAA, AAAA-MM ou AAAA-MM-DD)<input
            v-model="form.publicacao"
            pattern="[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?"
            placeholder="Desconhecida" /></label
        ><label>DOI<input v-model="form.doi" /></label>
      </div>
      <label
        >Link da publicação<input
          v-model="form.link"
          type="url"
          placeholder="https://" /></label
      ><label
        >BibTeX (opcional)<textarea v-model="form.bibtex" rows="3"></textarea>
      </label>
      <div class="row">
        <button>Salvar fonte</button
        ><button type="button" class="secondary" @click="show = false">
          Cancelar
        </button>
      </div>
    </form>
    <div v-if="!items.length" class="empty card">
      Suas fontes aparecerão aqui. Você pode arrastar um resultado da busca para
      esta área.
    </div>
    <article v-for="f in items" :key="f.id" class="source-card">
      <h3>{{ f.titulo }}</h3>
      <p>
        {{ f.autores.join("; ") || "Autores desconhecidos" }} ·
        {{ f.publicacao || "Data desconhecida" }}
      </p>
      <div class="row">
        <a
          v-if="f.link"
          :href="f.link"
          target="_blank"
          rel="noopener noreferrer"
          >Publicação ↗</a
        ><button class="text-button" @click="open(f)">Editar</button
        ><button class="text-button danger-text" @click="remove(f)">
          Excluir
        </button>
      </div>
      <details>
        <summary>BibTeX</summary>
        <pre>{{ f.bibtex }}</pre>
      </details>
    </article>
    <details class="card">
      <summary>Importar BibTeX</summary>
      <form @submit.prevent="importBib">
        <label
          >Arquivo .bib<input
            type="file"
            accept=".bib,.txt"
            @change="readFile" /></label
        ><label
          >Conteúdo BibTeX<textarea
            v-model="bibtex"
            required
            rows="7"
            placeholder="@article{chave, title={Título}, author={Autor}}"
          ></textarea></label
        ><button>Importar entradas</button>
      </form>
    </details>
  </section>
</template>
