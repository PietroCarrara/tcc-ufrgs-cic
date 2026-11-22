<script setup lang="ts">
import { ref } from "vue";
import { api, enviar } from "../core/http.js";
import { useApp } from "../core/state.js";
import type { ArquivoDTO } from "../../../../packages/shared/src/index.js";
const props = defineProps<{ projectId: string; items: ArquivoDTO[] }>(),
  emit = defineEmits<{ changed: [] }>(),
  state = useApp(),
  error = ref(""),
  busy = ref(false),
  selected = ref<File | null>(null),
  key = ref("");
function choose(e: Event) {
  selected.value = (e.target as HTMLInputElement).files?.[0] ?? null;
  key.value = crypto.randomUUID();
}
async function send() {
  if (!selected.value) return;
  busy.value = true;
  error.value = "";
  try {
    const data = new FormData();
    data.append("arquivo", selected.value);
    await api(`/api/projetos/${props.projectId}/arquivos`, {
      method: "POST",
      body: data,
      headers: { "Idempotency-Key": key.value },
    });
    selected.value = null;
    emit("changed");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function remove(f: ArquivoDTO) {
  if (!confirm(`Excluir “${f.nome}”?`)) return;
  try {
    await enviar(
      `/api/projetos/${props.projectId}/arquivos/${f.id}`,
      {},
      "DELETE",
    );
    emit("changed");
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>
<template>
  <h2>Arquivos do projeto</h2>
  <p class="muted">
    PDF, TXT, BibTeX, PNG, JPEG e WebP · até
    {{ state.capabilities.limites.upload / 1048576 }} MiB por arquivo ·
    {{ state.capabilities.limites.arquivosProjeto / 1048576 }} MiB por projeto.
  </p>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <form class="card row" @submit.prevent="send">
    <label class="grow"
      >Selecione um arquivo<input
        type="file"
        accept=".pdf,.txt,.bib,.png,.jpg,.jpeg,.webp"
        @change="choose" /></label
    ><button :disabled="busy || !selected">
      {{ busy ? "Enviando…" : "Enviar arquivo" }}
    </button>
  </form>
  <div v-if="!items.length" class="empty card">Nenhum arquivo anexado.</div>
  <article v-for="f in items" :key="f.id" class="card row spread">
    <div>
      <h3>{{ f.nome }}</h3>
      <p>{{ (f.tamanho / 1024).toFixed(1) }} KiB · {{ f.mime }}</p>
    </div>
    <div class="row">
      <a
        class="button secondary"
        :href="`/api/projetos/${projectId}/arquivos/${f.id}`"
        download
        >Baixar</a
      ><button class="text-button danger-text" @click="remove(f)">
        Excluir
      </button>
    </div>
  </article>
</template>
