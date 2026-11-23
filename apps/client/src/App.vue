<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { isNavigationFailure, NavigationFailureType, useRouter } from "vue-router";
import { usuario, enviar, restaurar } from "./core/http.js";
import { useApp } from "./core/state.js";
import { navigation } from "./core/navigation.js";
import { limparUsuario } from "./core/drafts.js";
import type { RegistroDeModulos } from "./core/registry.js";
import type { Contribuicao } from "../../../packages/module-sdk/src/client.js";
const router = useRouter(),
  state = useApp(),
  registry = inject<RegistroDeModulos>("registro")!;
const error = ref("");
let timer: ReturnType<typeof setInterval>;
const extra = computed(() => {
  const list: Contribuicao[] = [];
  registry.dispararEvento("listarItensDeNavegacao", [list]);
  return list.filter(
    (i) =>
      !i.papeis || (!!usuario.value && i.papeis.includes(usuario.value.papel)),
  );
});
const refresh = () => {
  if (document.visibilityState === "visible") void state.atualizar();
};
onMounted(() => {
  refresh();
  timer = setInterval(refresh, 30000);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
});
onUnmounted(() => {
  clearInterval(timer);
  window.removeEventListener("focus", refresh);
  document.removeEventListener("visibilitychange", refresh);
});
watch(usuario, refresh);
async function logout() {
  try {
    const uid = usuario.value!.id;
    if (navigation.beforeLogout && !(await navigation.beforeLogout())) return;
    const result = await router.push("/");
    if (result && !isNavigationFailure(result, NavigationFailureType.duplicated)) return; // Fix logout
    await enviar("/api/logout");
    await limparUsuario(uid);
    usuario.value = null;
    await restaurar();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar">
      <RouterLink class="brand" to="/" aria-label="Trama, início"
        ><span class="brand-symbol">t.</span
        ><span>trama<small>ESPAÇO DE PESQUISA</small></span></RouterLink
      ><template v-if="usuario">
        <p class="nav-label">SEU PERCURSO</p>
        <nav aria-label="Navegação principal">
          <RouterLink to="/">⌂ <span>Meus projetos</span></RouterLink
          ><RouterLink to="/professores">◎ <span>Orientadores</span></RouterLink
          ><RouterLink to="/propostas">↗ <span>Propostas</span></RouterLink
          ><RouterLink to="/agenda">▦ <span>Minha semana</span></RouterLink
          ><RouterLink to="/notificacoes"
            >◉ <span>Notificações</span
            ><b v-if="state.naoLidas" class="badge">{{
              state.naoLidas
            }}</b></RouterLink
          ><RouterLink v-for="item in extra" :key="item.id" :to="item.path!">{{
            item.rotulo
          }}</RouterLink>
        </nav>
        <div class="sidebar-note">
          <span class="tiny-leaf">✳</span>
          <p>Uma ideia de cada vez.<br />Um projeto que avança.</p>
        </div>
        <div class="account">
          <RouterLink to="/perfil"
            ><span class="avatar">{{ usuario.nome.slice(0, 1) }}</span
            ><span
              >{{ usuario.nome
              }}<small>{{
                usuario.papel === "aluno" ? "Estudante" : "Professor(a)"
              }}</small></span
            ></RouterLink
          ><button class="text-button" @click="logout">Sair</button>
        </div>
      </template>
      <p v-else class="sidebar-note">
        Da primeira ideia<br />à última referência.
      </p>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <span>SEU TRABALHO, EM CONSTRUÇÃO</span
        ><span>{{ state.capabilities.timezone }}</span>
      </header>
      <main id="conteudo">
        <div v-if="error" class="alert" role="alert">{{ error }}</div>
        <div
          v-for="message in registry.diagnosticos"
          :key="message"
          class="notice"
        >
          {{ message }}
        </div>
        <RouterView :key="$route.path" />
      </main>
      <footer>
        TRAMA <span>Um espaço para desenvolver conhecimento.</span>
      </footer>
    </div>
  </div>
</template>
