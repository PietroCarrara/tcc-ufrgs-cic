<script setup lang="ts">
import { ref } from "vue";
import { api, enviar, usuario } from "../core/http.js";
import type {
  ProjetoDTO,
  User,
} from "../../../../packages/shared/src/index.js";
import { dias, horario } from "../../../../packages/shared/src/index.js";
import Pagination from "../components/Pagination.vue";
const props = defineProps<{ project: ProjetoDTO }>(),
  emit = defineEmits<{ changed: []; before: [] }>(),
  candidates = ref<User[]>([]),
  q = ref(""),
  error = ref(""),
  conflicts = ref<any[]>([]),
  total = ref(0),
  page = ref(1);
async function search(p = 1) {
  page.value = p;
  try {
    const r = await api(
      `/api/projetos/${props.project.id}/candidatos?q=${encodeURIComponent(q.value)}&pagina=${p}`,
    );
    candidates.value = r.itens;
    total.value = r.total;
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function change(uid: string, remove = false) {
  if (remove && !confirm("Remover este membro do projeto?")) return;
  try {
    const r = await enviar(
      `/api/projetos/${props.project.id}/membros/${uid}`,
      { versao: props.project.versao },
      remove ? "DELETE" : "POST",
    );
    conflicts.value = r.conflitos;
    emit("changed");
    await search();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>
<template>
  <h2>Quem constrói este projeto</h2>
  <p>O projeto mantém ao menos um autor e um orientador.</p>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <div v-if="conflicts.length" class="notice">
    <h3>Conflitos nas reuniões existentes</h3>
    <p>O membro foi adicionado. As reuniões foram mantidas.</p>
    <ul>
      <li v-for="(c, i) in conflicts" :key="i">
        {{ c.nome }} · {{ dias[c.dia] }} {{ horario(c.inicio) }}–{{
          horario(c.fim)
        }}
      </li>
    </ul>
  </div>
  <article v-for="m in project.membros" :key="m.id" class="card row spread">
    <div class="row">
      <span class="avatar">{{ m.nome[0] }}</span>
      <div>
        <h3>{{ m.nome }}</h3>
        <small>{{ m.papel === "aluno" ? "Autor(a)" : "Orientador(a)" }}</small>
      </div>
    </div>
    <button
      v-if="usuario?.papel === 'professor'"
      class="text-button danger-text"
      @click="change(m.id, true)"
    >
      Remover
    </button>
  </article>
  <section v-if="usuario?.papel === 'professor'" class="card">
    <h3>Adicionar membro</h3>
    <form class="row" @submit.prevent="search()">
      <label class="grow"
        >Nome<input
          v-model="q"
          placeholder="Buscar aluno ou professor" /></label
      ><button>Buscar</button>
    </form>
    <div v-for="c in candidates" :key="c.id" class="row spread candidate">
      <span>{{ c.nome }} · {{ c.papel }}</span
      ><button class="secondary" @click="change(c.id)">Adicionar</button>
    </div>
    <Pagination :page="page" :total="total" @change="search" />
  </section>
</template>
