<script setup lang="ts">
import { ref, computed } from "vue";
import { api } from "../../apps/client/src/core/http.js";
import { useApp } from "../../apps/client/src/core/state.js";
import Fontes from "../../apps/client/src/features/Fontes.vue";
import type { FonteDTO } from "../../packages/shared/src/index.js";
const props = defineProps<{ projectId: string; fontes: FonteDTO[] }>(),
  emit = defineEmits<{ changed: [] }>(),
  state = useApp();
const q = ref(""),
  page = ref(1),
  results = ref<any[]>([]),
  more = ref(false),
  error = ref(""),
  busy = ref(false),
  searched = ref(false),
  sources = ref<InstanceType<typeof Fontes>>();
const external = computed(
  () => `https://scholar.google.com/scholar?q=${encodeURIComponent(q.value)}`,
);
async function search(p = 1) {
  busy.value = true;
  error.value = "";
  page.value = p;
  try {
    const r = await api(
      `/api/projetos/${props.projectId}/busca-referencias?q=${encodeURIComponent(q.value)}&pagina=${p}`,
    );
    results.value = r.itens;
    more.value = r.mais;
    searched.value = true;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
function drag(e: DragEvent, result: any) {
  e.dataTransfer?.setData("application/x-trama-fonte", JSON.stringify(result));
}
</script>
<template>
  <div class="scholar-layout">
    <section class="card">
      <h2>Buscar referências</h2>
      <p class="muted">Google Scholar via SerpApi · serviço terceiro</p>
      <form @submit.prevent="search()">
        <label
          >Termos da pesquisa<input
            v-model="q"
            maxlength="300"
            required
            placeholder="Tema, autor ou publicação" /></label
        ><button :disabled="busy || !state.capabilities.buscaConfigurada">
          {{ busy ? "Buscando…" : "Buscar no Scholar" }}
        </button>
      </form>
      <p v-if="!state.capabilities.buscaConfigurada" class="notice">
        Busca integrada indisponível: a chave do provedor não foi configurada.
        As fontes manuais e a importação BibTeX continuam disponíveis.
      </p>
      <p>
        <a :href="external" target="_blank" rel="noopener noreferrer"
          >Abrir pesquisa no Google Scholar ↗</a
        >
      </p>
      <p v-if="error" class="alert" role="alert">{{ error }}</p>
      <p v-if="searched && !results.length" class="empty">
        Nenhum resultado para esta pesquisa.
      </p>
      <article
        v-for="(result, i) in results"
        :key="i"
        class="search-result"
        draggable="true"
        @dragstart="drag($event, result)"
      >
        <h3>{{ result.titulo }}</h3>
        <p>
          {{ result.autores.join("; ") || "Autores desconhecidos" }} ·
          {{ result.publicacao || "Data desconhecida" }}
        </p>
        <div class="row">
          <button class="secondary" @click="sources?.open(result)">
            Adicionar fonte</button
          ><a
            v-if="result.link"
            :href="result.link"
            target="_blank"
            rel="noopener noreferrer"
            >Abrir ↗</a
          >
        </div>
      </article>
      <div v-if="searched" class="pagination">
        <button
          class="secondary"
          :disabled="page === 1 || busy"
          @click="search(page - 1)"
        >
          Anterior</button
        ><span>{{ page }}</span
        ><button
          class="secondary"
          :disabled="!more || busy"
          @click="search(page + 1)"
        >
          Próxima
        </button>
      </div>
    </section>
    <Fontes
      ref="sources"
      :project-id="projectId"
      :items="fontes"
      @changed="emit('changed')"
    />
  </div>
</template>
