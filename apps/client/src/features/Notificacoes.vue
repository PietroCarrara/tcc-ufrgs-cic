<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, enviar } from "../core/http.js";
import { useApp } from "../core/state.js";
import Pagination from "../components/Pagination.vue";
const items = ref<any[]>([]),
  error = ref(""),
  page = ref(1),
  total = ref(0),
  state = useApp();
async function load(p = 1) {
  page.value = p;
  try {
    const r = await api(`/api/notificacoes?pagina=${p}`);
    items.value = r.itens;
    total.value = r.total;
    await state.atualizar();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function mark(id?: string) {
  try {
    await enviar(
      id ? `/api/notificacoes/${id}` : "/api/notificacoes/marcar-todas-lidas",
      id ? { lida: true } : {},
      id ? "PATCH" : "POST",
    );
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
      <p class="eyebrow">MANTENHA-SE POR PERTO</p>
      <h1>Notificações<span class="accent">.</span></h1>
    </div>
    <button class="secondary" @click="mark()">Marcar todas como lidas</button>
  </div>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <div v-if="!items.length" class="card empty">Nenhuma notificação.</div>
  <article
    v-for="n in items"
    :key="n.id"
    class="card notification"
    :class="{ unread: !n.lida }"
  >
    <div class="row spread">
      <h2>{{ n.titulo }}</h2>
      <small>{{ new Date(n.criado_em).toLocaleString("pt-BR") }}</small>
    </div>
    <p>{{ n.texto }}</p>
    <div class="row">
      <RouterLink :to="n.link">Abrir →</RouterLink
      ><button v-if="!n.lida" class="text-button" @click="mark(n.id)">
        Marcar como lida
      </button>
    </div>
  </article>
  <Pagination :page="page" :total="total" @change="load" />
</template>
