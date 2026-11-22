<script setup lang="ts">
import { inject, onMounted, ref } from "vue";
import { api, usuario } from "../core/http.js";
import type { RegistroDeModulos } from "../core/registry.js";
import type { Contribuicao } from "../../../../packages/module-sdk/src/client.js";
import Pagination from "../components/Pagination.vue";
const reg = inject<RegistroDeModulos>("registro")!,
  buttons: Contribuicao[] = [];
reg.dispararEvento("listarBotoesDeLogin", [buttons]);
const projects = ref<any[]>([]),
  notes = ref<any[]>([]),
  error = ref(""),
  loading = ref(true),
  page = ref(1),
  total = ref(0);
async function load(p = 1) {
  page.value = p;
  try {
    const [a, b] = await Promise.all([
      api(`/api/projetos?pagina=${p}`),
      api("/api/notificacoes?limite=3"),
    ]);
    projects.value = a.itens;
    total.value = a.total;
    notes.value = b.itens;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  if (usuario.value) void load();
  else loading.value = false;
});
</script>
<template>
  <template v-if="!usuario">
    <section class="welcome">
      <p class="eyebrow">IDEIAS GANHAM FORMA AQUI</p>
      <h1>Todo grande trabalho<br />começa com uma <em>ideia.</em></h1>
      <p class="lead">
        Encontre orientação, conecte referências e dê forma ao seu TCC. Um
        espaço organizado para cada etapa da sua pesquisa.
      </p>
      <RouterLink
        v-for="button in buttons"
        :key="button.id"
        class="button"
        :to="button.path!"
        >{{ button.rotulo }} ↗</RouterLink
      >
      <p v-if="!buttons.length" class="alert">
        Autenticação indisponível. O operador precisa habilitar um módulo
        compatível.
      </p>
      <div class="welcome-steps">
        <div>
          <b>01</b>
          <h3>Encontre sua direção</h3>
          <p>Conheça professores e compartilhe sua proposta.</p>
        </div>
        <div>
          <b>02</b>
          <h3>Construa conhecimento</h3>
          <p>Escreva com suas fontes, figuras e referências por perto.</p>
        </div>
        <div>
          <b>03</b>
          <h3>Mantenha o ritmo</h3>
          <p>Organize reuniões e acompanhe cada novo passo.</p>
        </div>
      </div>
    </section> </template
  ><template v-else>
    <div class="page-title">
      <div>
        <p class="eyebrow">UM NOVO PASSO NA SUA PESQUISA</p>
        <h1>
          Olá, {{ usuario.nome.split(" ")[0] }}<span class="accent">.</span>
        </h1>
        <p>Suas ideias têm espaço para crescer.</p>
      </div>
      <RouterLink class="button secondary" to="/professores"
        >Explorar orientadores ↗</RouterLink
      >
    </div>
    <section class="journey-banner">
      <div>
        <span class="tag">SEU PERCURSO ACADÊMICO</span>
        <h2>Da pergunta ao conhecimento.</h2>
        <p>Retome seu projeto e transforme mais uma ideia em texto.</p>
      </div>
      <div class="abstract-pages" aria-hidden="true">
        <i></i><i></i><i>✳</i>
      </div>
    </section>
    <div class="dashboard-grid">
      <section>
        <div class="section-title">
          <h2>Meus projetos</h2>
          <span>{{ total }} em desenvolvimento</span>
        </div>
        <p v-if="error" class="alert" role="alert">
          {{ error }} <button @click="load()">Tentar novamente</button>
        </p>
        <p v-if="loading" class="empty">Carregando projetos…</p>
        <div v-else-if="!projects.length && !error" class="card empty">
          <h3>Sua pesquisa começa com uma conexão.</h3>
          <p>
            Envie uma proposta a um orientador. Quando ela for aceita, seu
            projeto aparecerá aqui.
          </p>
          <RouterLink to="/professores">Conhecer orientadores →</RouterLink>
        </div>
        <RouterLink
          v-for="p in projects"
          :key="p.id"
          :to="`/projetos/${p.id}`"
          class="project-card"
          ><div class="project-icon">▤</div>
          <div>
            <span class="eyebrow">PROJETO DE PESQUISA</span>
            <h3>{{ p.titulo }}</h3>
            <p>
              Atualizado em
              {{ new Date(p.atualizado_em).toLocaleDateString("pt-BR") }}
            </p>
          </div>
          <span class="arrow">↗</span></RouterLink
        ><Pagination :page="page" :total="total" @change="load" />
      </section>
      <section>
        <div class="section-title">
          <h2>Últimas novidades</h2>
          <RouterLink to="/notificacoes">Ver todas</RouterLink>
        </div>
        <div class="card">
          <p v-if="!notes.length" class="muted">Nenhuma notificação ainda.</p>
          <RouterLink
            v-for="n in notes"
            :key="n.id"
            :to="n.link"
            class="note-item"
            ><span class="dot" :class="{ read: n.lida }"></span>
            <div>
              <h3>{{ n.titulo }}</h3>
              <p>{{ n.texto }}</p>
              <small>{{
                new Date(n.criado_em).toLocaleDateString("pt-BR")
              }}</small>
            </div></RouterLink
          >
        </div>
        <RouterLink class="agenda-link" to="/agenda"
          ><span>▦</span>
          <div>
            <b>Como está sua semana?</b>
            <p>Consulte e organize seus horários.</p>
          </div>
          →</RouterLink
        >
      </section>
    </div>
  </template>
</template>
