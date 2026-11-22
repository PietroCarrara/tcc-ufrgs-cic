<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api, enviar, usuario } from "../core/http.js";
import { dias } from "../../../../packages/shared/src/index.js";
import { renderDocumento } from "../../../../packages/shared/src/render.js";
import Pagination from "../components/Pagination.vue";
const route = useRoute(),
  items = ref<any[]>([]),
  selected = ref<any>(null),
  texto = ref(""),
  days = ref<number[]>([]),
  inicio = ref(540),
  fim = ref(600),
  title = ref(""),
  description = ref(""),
  error = ref(""),
  success = ref(""),
  loading = ref(false),
  page = ref(1),
  total = ref(0);
let sequence = 0;
async function load(p = 1) {
  const current = ++sequence;
  loading.value = true;
  error.value = "";
  page.value = p;
  try {
    if (route.params.id)
      selected.value = await api(`/api/professores/${route.params.id}`);
    const params = new URLSearchParams({
      texto: texto.value,
      pagina: String(p),
    });
    if (days.value.length) {
      params.set("dias", days.value.join(","));
      params.set("inicio", String(inicio.value));
      params.set("fim", String(fim.value));
    }
    const data = await api(`/api/professores?${params}`);
    if (current !== sequence) return;
    items.value = data.itens;
    total.value = data.total;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
async function send() {
  error.value = "";
  try {
    await enviar("/api/propostas", {
      professorId: selected.value.id,
      titulo: title.value,
      descricao: description.value,
    });
    success.value = "Proposta enviada. O professor foi notificado.";
    title.value = "";
    description.value = "";
    await load(page.value);
  } catch (e) {
    error.value = (e as Error).message;
  }
}
onMounted(() => load());
</script>
<template>
  <div class="page-title">
    <div>
      <p class="eyebrow">CONEXÕES QUE ORIENTAM</p>
      <h1>Encontre sua orientação<span class="accent">.</span></h1>
      <p>Explore interesses em comum e dê o primeiro passo.</p>
    </div>
  </div>
  <form class="card filters" @submit.prevent="load()">
    <label class="grow"
      >Nome, biografia ou tema de pesquisa<input
        v-model="texto"
        placeholder="O que você quer pesquisar?"
    /></label>
    <fieldset>
      <legend>Dias disponíveis</legend>
      <label v-for="(d, i) in dias" :key="d" class="check"
        ><input v-model="days" type="checkbox" :value="i" />{{
          d.slice(0, 3)
        }}</label
      >
    </fieldset>
    <label
      >Início<select v-model="inicio">
        <option v-for="n in 96" :key="n" :value="(n - 1) * 15">
          {{ String(Math.floor((n - 1) / 4)).padStart(2, "0") }}:{{
            String(((n - 1) % 4) * 15).padStart(2, "0")
          }}
        </option>
      </select></label
    ><label
      >Fim<select v-model="fim">
        <option v-for="n in 96" :key="n" :value="n * 15">
          {{ String(Math.floor(n / 4)).padStart(2, "0") }}:{{
            String((n % 4) * 15).padStart(2, "0")
          }}
        </option>
      </select></label
    ><button>Filtrar</button
    ><small class="full"
      >O professor deve estar livre durante todo o intervalo em pelo menos um
      dos dias selecionados.</small
    >
  </form>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <p v-if="success" class="success" role="status">{{ success }}</p>
  <p v-if="loading" role="status">Buscando orientadores…</p>
  <div class="directory-layout">
    <section>
      <p class="muted">{{ total }} orientadores encontrados</p>
      <div v-if="!items.length && !loading" class="empty card">
        Nenhum professor atende a esses filtros.
      </div>
      <article v-for="p in items" :key="p.id" class="card professor-card">
        <div class="row">
          <img
            v-if="p.foto"
            class="avatar"
            :src="`/api/usuarios/${p.id}/foto`"
            alt=""
          /><span v-else class="avatar">{{ p.nome[0] }}</span>
          <div>
            <h2>{{ p.nome }}</h2>
            <span class="muted">Professor(a) orientador(a)</span>
          </div>
        </div>
        <div
          class="rich-preview"
          v-html="renderDocumento(p.biografia, [], undefined, false)"
        ></div>
        <div class="row spread">
          <span
            >{{ p.projetos }} projetos · {{ p.propostas }} propostas
            pendentes</span
          ><button
            class="secondary"
            @click="
              selected = p;
              success = '';
              error = '';
            "
          >
            Ver perfil →
          </button>
        </div>
      </article>
      <Pagination :page="page" :total="total" @change="load" />
    </section>
    <aside v-if="selected" class="card detail-panel">
      <button
        class="text-button float-right"
        aria-label="Fechar perfil"
        @click="selected = null"
      >
        Fechar ×
      </button>
      <p class="eyebrow">PERFIL DO ORIENTADOR</p>
      <h2>{{ selected.nome }}</h2>
      <div
        v-html="renderDocumento(selected.biografia, [], undefined, false)"
      ></div>
      <h3>Sugestões de pesquisa</h3>
      <p v-if="!selected.sugestoes.length" class="muted">
        Nenhuma sugestão cadastrada.
      </p>
      <div
        v-for="(suggestion, i) in selected.sugestoes"
        :key="i"
        v-html="renderDocumento(suggestion, [], undefined, false)"
      ></div>
      <form v-if="usuario?.papel === 'aluno'" @submit.prevent="send">
        <h3>Compartilhe sua proposta</h3>
        <label
          >Título sugerido<input
            v-model="title"
            required
            maxlength="300" /></label
        ><label
          >Descrição da proposta<textarea
            v-model="description"
            required
            rows="6"
            maxlength="10000"
          ></textarea></label
        ><button>Enviar proposta ↗</button>
      </form>
    </aside>
  </div>
</template>
