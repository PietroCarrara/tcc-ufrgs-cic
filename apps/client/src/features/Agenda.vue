<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api, enviar } from "../core/http.js";
import { useApp } from "../core/state.js";
import type {
  AtividadeDTO,
  Intervalo,
} from "../../../../packages/shared/src/index.js";
import Schedule from "../components/Schedule.vue";
import ActivityForm from "../components/ActivityForm.vue";
const items = ref<AtividadeDTO[]>([]),
  form = ref<Intervalo | null>(null),
  editing = ref<AtividadeDTO | null>(null),
  error = ref(""),
  busy = ref(false),
  router = useRouter(),
  state = useApp();
async function load() {
  try {
    items.value = (await api("/api/me/agenda")).itens;
  } catch (e) {
    error.value = (e as Error).message;
  }
}
function select(a: { dia: number; inicio: number; fim: number }) {
  editing.value = null;
  form.value = { ...a, descricao: "" };
}
function edit(a: AtividadeDTO) {
  if (a.projeto_id) {
    void router.push(`/projetos/${a.projeto_id}?aba=reunioes`);
    return;
  }
  editing.value = a;
  form.value = { ...a };
}
async function save(a: Intervalo) {
  busy.value = true;
  error.value = "";
  try {
    await enviar(
      `/api/me/atividades${editing.value ? "/" + editing.value.id : ""}`,
      { ...a, versao: editing.value?.versao },
      editing.value ? "PATCH" : "POST",
    );
    form.value = null;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (!editing.value || !confirm("Excluir esta atividade pessoal?")) return;
  try {
    await enviar(
      `/api/me/atividades/${editing.value.id}`,
      { versao: editing.value.versao },
      "DELETE",
    );
    form.value = null;
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
onMounted(load);
</script>
<template>
  <div class="page-title">
    <div>
      <p class="eyebrow">ESPAÇO PARA O QUE IMPORTA</p>
      <h1>Minha semana<span class="accent">.</span></h1>
      <p>Arraste na grade ou use o formulário para reservar um horário.</p>
    </div>
    <button @click="select({ dia: 1, inicio: 540, fim: 600 })">
      + Nova atividade
    </button>
  </div>
  <p class="muted">
    {{ state.capabilities.timezone }} · Domingo a sábado · Reuniões aparecem em
    verde
  </p>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <section v-if="form" class="card">
    <div class="section-title">
      <h2>{{ editing ? "Editar atividade" : "Nova atividade" }}</h2>
      <button v-if="editing" class="text-button danger-text" @click="remove">
        Excluir atividade
      </button>
    </div>
    <ActivityForm
      :value="form"
      :busy="busy"
      @save="save"
      @cancel="form = null"
    />
  </section>
  <Schedule :items="items" @select="select" @edit="edit" />
</template>
