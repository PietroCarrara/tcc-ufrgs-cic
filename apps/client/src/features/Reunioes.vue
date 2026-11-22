<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, enviar, ApiError } from "../core/http.js";
import {
  dias,
  horario,
  type AtividadeDTO,
  type Intervalo,
} from "../../../../packages/shared/src/index.js";
import ActivityForm from "../components/ActivityForm.vue";
const props = defineProps<{ projectId: string }>(),
  items = ref<AtividadeDTO[]>([]),
  occupation = ref<any[]>([]),
  form = ref<Intervalo | null>(null),
  editing = ref<AtividadeDTO | null>(null),
  error = ref(""),
  conflict = ref<any>(null),
  pending = ref<Intervalo | null>(null),
  key = ref(crypto.randomUUID()),
  busy = ref(false);
async function load() {
  try {
    const [a, b] = await Promise.all([
      api(`/api/projetos/${props.projectId}/reunioes`),
      api(`/api/projetos/${props.projectId}/ocupacao`),
    ]);
    items.value = a.itens;
    occupation.value = b.itens;
  } catch (e) {
    error.value = (e as Error).message;
  }
}
function open(a?: AtividadeDTO) {
  editing.value = a ?? null;
  form.value = a ? { ...a } : { dia: 1, inicio: 600, fim: 660, descricao: "" };
  conflict.value = null;
  key.value = crypto.randomUUID();
  error.value = "";
}
async function save(a: Intervalo, token?: string) {
  busy.value = true;
  error.value = "";
  pending.value = { ...a };
  try {
    await enviar(
      `/api/projetos/${props.projectId}/reunioes${editing.value ? "/" + editing.value.id : ""}`,
      { ...a, versao: editing.value?.versao, token },
      editing.value ? "PATCH" : "POST",
      { "Idempotency-Key": key.value },
    );
    form.value = null;
    conflict.value = null;
    await load();
  } catch (e) {
    if (e instanceof ApiError && e.codigo === "CONFLITO_DE_HORARIOS")
      conflict.value = e.detalhes;
    else error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function remove(a: AtividadeDTO) {
  if (!confirm("Excluir esta reunião e notificar os demais membros?")) return;
  try {
    await enviar(
      `/api/projetos/${props.projectId}/reunioes/${a.id}`,
      { versao: a.versao },
      "DELETE",
    );
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
onMounted(load);
</script>
<template>
  <div class="section-title">
    <h2>Reuniões semanais</h2>
    <button @click="open()">+ Nova reunião</button>
  </div>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <section v-if="form" class="card">
    <h3>{{ editing ? "Editar reunião" : "Agendar reunião" }}</h3>
    <ActivityForm
      :value="form"
      :busy="busy"
      @save="save"
      @cancel="
        form = null;
        conflict = null;
      "
    />
    <section v-if="conflict" class="conflict" role="alert">
      <h3>Conflito de horários</h3>
      <p>A reunião ainda não foi salva. Confira os participantes ocupados:</p>
      <ul>
        <li v-for="(c, i) in conflict.conflitos" :key="i">
          {{ c.nome }} · {{ dias[c.dia] }} {{ horario(c.inicio) }}–{{
            horario(c.fim)
          }}
        </li>
      </ul>
      <div class="row">
        <button class="secondary" @click="conflict = null">
          Voltar e ajustar</button
        ><button :disabled="busy" @click="save(pending!, conflict.token)">
          Salvar mesmo assim
        </button>
      </div>
    </section>
    <details>
      <summary>Ocupação dos participantes</summary>
      <p class="muted">
        Descrições pessoais e de outros projetos são privadas.
      </p>
      <p v-if="!occupation.length">Todos os participantes estão livres.</p>
      <ul>
        <li v-for="(a, i) in occupation" :key="i">
          {{ a.nome }} · {{ dias[a.dia] }} {{ horario(a.inicio) }}–{{
            horario(a.fim)
          }}
        </li>
      </ul>
    </details>
  </section>
  <div v-if="!items.length" class="empty card">Nenhuma reunião agendada.</div>
  <article v-for="a in items" :key="a.id" class="card row spread">
    <div>
      <h3>{{ a.descricao }}</h3>
      <p>{{ dias[a.dia] }} · {{ horario(a.inicio) }}–{{ horario(a.fim) }}</p>
    </div>
    <div class="row">
      <button class="secondary" @click="open(a)">Editar</button
      ><button class="text-button danger-text" @click="remove(a)">
        Excluir
      </button>
    </div>
  </article>
</template>
