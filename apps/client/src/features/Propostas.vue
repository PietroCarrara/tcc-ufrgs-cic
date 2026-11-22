<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, enviar, usuario } from "../core/http.js";
import { useRouter } from "vue-router";
import Pagination from "../components/Pagination.vue";
const items = ref<any[]>([]),
  error = ref(""),
  loading = ref(true),
  reject = ref(""),
  motivo = ref(""),
  page = ref(1),
  total = ref(0),
  router = useRouter();
async function load(p = 1) {
  page.value = p;
  error.value = "";
  try {
    const r = await api(`/api/propostas?pagina=${p}`);
    items.value = r.itens;
    total.value = r.total;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
async function decide(id: string, accept: boolean) {
  error.value = "";
  try {
    const result = await enviar(
      `/api/propostas/${id}/${accept ? "aceitar" : "rejeitar"}`,
      accept ? {} : { motivo: motivo.value },
    );
    reject.value = "";
    motivo.value = "";
    if (accept) await router.push(`/projetos/${result.id}`);
    else await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
onMounted(() => load());
</script>
<template>
  <div class="page-title">
    <div>
      <p class="eyebrow">O INÍCIO DE UMA PARCERIA</p>
      <h1>Propostas<span class="accent">.</span></h1>
      <p>
        {{
          usuario?.papel === "aluno"
            ? "Acompanhe as propostas que você enviou."
            : "Conheça as ideias dos seus futuros orientandos."
        }}
      </p>
    </div>
    <RouterLink to="/professores" class="button secondary"
      >Ver orientadores</RouterLink
    >
  </div>
  <p v-if="error" role="alert" class="alert">{{ error }}</p>
  <p v-if="loading">Carregando…</p>
  <div v-else-if="!items.length" class="empty card">
    Nenhuma proposta pendente. Os resultados de propostas processadas ficam nas
    notificações.
  </div>
  <article v-for="p in items" :key="p.id" class="card proposal">
    <span class="tag">AGUARDANDO RESPOSTA</span>
    <h2>{{ p.titulo }}</h2>
    <p class="muted">{{ p.aluno_nome }} → {{ p.professor_nome }}</p>
    <p class="preserve">{{ p.descricao }}</p>
    <div v-if="usuario?.papel === 'professor'" class="row">
      <button @click="decide(p.id, true)">Aceitar e criar projeto</button
      ><button class="secondary" @click="reject = p.id">
        Recusar proposta
      </button>
    </div>
    <form v-if="reject === p.id" @submit.prevent="decide(p.id, false)">
      <label
        >Motivo da recusa<textarea
          v-model="motivo"
          required
          maxlength="5000"
        ></textarea>
      </label>
      <div class="row">
        <button class="danger">Confirmar recusa</button
        ><button type="button" class="secondary" @click="reject = ''">
          Cancelar
        </button>
      </div>
    </form>
  </article>
  <Pagination :page="page" :total="total" @change="load" />
</template>
