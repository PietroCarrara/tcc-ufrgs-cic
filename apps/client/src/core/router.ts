import { createRouter, createWebHistory } from "vue-router";
import { usuario } from "./http.js";
import Home from "../features/Home.vue";
import Professores from "../features/Professores.vue";
import Propostas from "../features/Propostas.vue";
import Agenda from "../features/Agenda.vue";
import Perfil from "../features/Perfil.vue";
import Notificacoes from "../features/Notificacoes.vue";
import Projeto from "../features/Projeto.vue";
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { name: "inicio", path: "/", component: Home, meta: { publica: true } },
    { name: "professores", path: "/professores", component: Professores },
    { name: "professor", path: "/professores/:id", component: Professores },
    { name: "propostas", path: "/propostas", component: Propostas },
    { name: "agenda", path: "/agenda", component: Agenda },
    { name: "perfil", path: "/perfil", component: Perfil },
    { name: "notificacoes", path: "/notificacoes", component: Notificacoes },
    { name: "projeto", path: "/projetos/:id", component: Projeto },
    {
      name: "nao-encontrada",
      path: "/:pathMatch(.*)*",
      component: Home,
      meta: { publica: true },
    },
  ],
});
router.beforeEach((to) => {
  if (!to.meta.publica && !usuario.value) return "/";
  const roles = to.meta.papeis as string[] | undefined;
  if (roles && usuario.value && !roles.includes(usuario.value.papel))
    return "/";
});
