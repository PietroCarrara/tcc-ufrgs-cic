<script setup lang="ts">
import { computed, inject, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, onBeforeRouteLeave } from "vue-router";
import { api, enviar, todos, usuario, download } from "../core/http.js";
import type { RegistroDeModulos } from "../core/registry.js";
import { navigation } from "../core/navigation.js";
import { Autosave, type SaveStatus } from "../core/autosave.js";
import {
  recuperar,
  descartar,
  guardar,
  apagar,
  draftKey,
  type Draft,
} from "../core/drafts.js";
import {
  type ProjetoDTO,
  type FonteDTO,
  type ArquivoDTO,
  textoVisivel,
} from "../../../../packages/shared/src/index.js";
import { renderDocumento } from "../../../../packages/shared/src/render.js";
import type {
  Contribuicao,
  ContextoProjeto,
} from "../../../../packages/module-sdk/src/client.js";
import Editor from "../components/Editor.vue";
import Fontes from "./Fontes.vue";
import Arquivos from "./Arquivos.vue";
import Reunioes from "./Reunioes.vue";
import Membros from "./Membros.vue";
const route = useRoute(),
  registry = inject<RegistroDeModulos>("registro")!,
  id = String(route.params.id),
  uid = usuario.value!.id;
const p = ref<ProjetoDTO | null>(null),
  fontes = ref<FonteDTO[]>([]),
  arquivos = ref<ArquivoDTO[]>([]),
  error = ref(""),
  status = ref<SaveStatus>("Salvo"),
  aba = ref(String(route.query.aba ?? "escrita")),
  draft = ref<Draft | null>(null),
  remote = ref<ProjetoDTO | null>(null),
  preview = ref(false),
  side = ref(false),
  recoveryError = ref(""),
  busy = ref(false),
  ready = ref(false);
let enabled = false;
let draftQueue = Promise.resolve();
const snapshot = () =>
  structuredClone(JSON.parse(JSON.stringify(p.value)) as ProjetoDTO);
const saver = new Autosave<ProjetoDTO>(
  snapshot,
  async (doc) => {
    const saved = await enviar<ProjetoDTO>(
      `/api/projetos/${id}/documento`,
      { ...doc, versao: p.value!.versao },
      "PUT",
    );
    p.value!.versao = saved.versao;
    await draftQueue;
    if (
      JSON.stringify({ ...snapshot(), versao: doc.versao }) ===
      JSON.stringify(doc)
    )
      await apagar(uid, id);
    else await persistDraft();
  },
  (s) => (status.value = s),
  async (e) => {
    error.value = (e as Error).message;
    if ((e as { status?: number }).status === 409) {
      try {
        remote.value = await api(`/api/projetos/${id}`);
      } catch (e) {
        error.value = (e as Error).message;
      }
    }
  },
);
function persistDraft() {
  if (!p.value) return Promise.resolve();
  const d = {
    key: draftKey(uid, id),
    userId: uid,
    projectId: id,
    baseVersion: p.value.versao,
    project: snapshot(),
    savedAt: Date.now(),
  };
  draftQueue = draftQueue
    .then(() => guardar(d))
    .catch((e) => {
      recoveryError.value = `Não foi possível guardar o rascunho no navegador: ${(e as Error).message}`;
    });
  return draftQueue;
}
watch(
  () => (p.value ? JSON.stringify({ ...p.value, versao: 0, membros: [] }) : ""),
  () => {
    if (enabled) {
      saver.dirty();
      void persistDraft();
    }
  },
  { flush: "sync" },
);
async function resources() {
  [fontes.value, arquivos.value] = await Promise.all([
    todos<FonteDTO>(`/api/projetos/${id}/fontes`),
    todos<ArquivoDTO>(`/api/projetos/${id}/arquivos`),
  ]);
}
async function refreshResources() {
  try {
    await resources();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function save() {
  error.value = "";
  if (draft.value) {
    error.value = "Resolva a recuperação do rascunho antes de salvar.";
    return false;
  }
  return saver.flush();
}
const context = computed<ContextoProjeto>(() => ({
  projeto: p.value!,
  salvar: save,
  download,
}));
const tabs = computed(() => {
  if (!p.value) return [];
  const list: Contribuicao[] = [];
  registry.dispararEvento("listarAbasDoProjeto", [list, context.value]);
  return list.filter(
    (i) =>
      !i.papeis || (!!usuario.value && i.papeis.includes(usuario.value.papel)),
  );
});
const actions = computed(() => {
  if (!p.value) return [];
  const list: Contribuicao[] = [];
  registry.dispararEvento("listarAcoesDoProjeto", [list, context.value]);
  return list.filter(
    (i) =>
      !i.papeis || (!!usuario.value && i.papeis.includes(usuario.value.papel)),
  );
});
const activeTab = computed(() => tabs.value.find((t) => t.id === aba.value));
async function runAction(action: Contribuicao) {
  busy.value = true;
  try {
    if (
      !textoVisivel(p.value!.resumo).trim() ||
      !p.value!.tituloIngles ||
      !p.value!.palavrasChave.length
    ) {
      if (
        !confirm(
          "Título em inglês, resumo ou palavras-chave incompletos. Exportar com os campos disponíveis?",
        )
      )
        return;
    }
    await action.executar?.(context.value);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function chooseDraft(restore: boolean) {
  enabled = false;
  const d = draft.value!;
  draft.value = null;
  if (restore) {
    const current = p.value!;
    p.value = { ...d.project, versao: d.baseVersion, membros: current.membros };
    saver.dirty();
    if (current.versao !== d.baseVersion) {
      saver.paused = true;
      status.value = "Conflito de versão";
      remote.value = current;
    }
    await persistDraft();
  } else await descartar(d);
  enabled = true;
}
async function resolveConflict(local: boolean) {
  if (!remote.value) return;
  enabled = false;
  if (local) p.value!.versao = remote.value.versao;
  else {
    p.value = remote.value;
    saver.clean();
    await apagar(uid, id);
  }
  remote.value = null;
  enabled = true;
  error.value = "";
  if (local) {
    saver.resume();
    await save();
  }
}
async function membersChanged() {
  try {
    const fresh = await api<ProjetoDTO>(`/api/projetos/${id}`);
    p.value!.versao = fresh.versao;
    p.value!.membros = fresh.membros;
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function switchTab(name: string) {
  if (name === "membros" && !(await save())) return;
  aba.value = name;
}
const unload = (e: BeforeUnloadEvent) => {
  if (saver.unsaved) {
    e.preventDefault();
    e.returnValue = "";
  }
};
onBeforeRouteLeave(async () => {
  if (saver.unsaved && !(await save()))
    return confirm(
      "Há alterações não salvas. O rascunho será mantido neste navegador. Sair mesmo assim?",
    );
  return true;
});
onMounted(async () => {
  navigation.beforeLogout = async () => {
    if (await save()) return true;
    if (
      !confirm(
        "Há alterações não salvas. Sair e apagar os rascunhos desta conta neste navegador?",
      )
    )
      return false;
    saver.clean();
    return true;
  };
  try {
    p.value = await api(`/api/projetos/${id}`);
    await resources();
    try {
      draft.value = (await recuperar(uid, id)) ?? null;
    } catch (e) {
      recoveryError.value = (e as Error).message;
    }
    enabled = true;
    ready.value = true;
  } catch (e) {
    error.value = (e as Error).message;
  }
  window.addEventListener("beforeunload", unload);
});
onBeforeUnmount(() => {
  navigation.beforeLogout = null;
  saver.destroy();
  window.removeEventListener("beforeunload", unload);
});
const count = computed(
  () =>
    textoVisivel(p.value?.texto ?? { type: "doc" })
      .trim()
      .split(/\s+/)
      .filter(Boolean).length,
);
</script>
<template>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <p v-if="recoveryError" class="alert" role="alert">{{ recoveryError }}</p>
  <p v-if="!ready && !error" role="status">Abrindo seu projeto…</p>
  <template v-if="p && ready">
    <div class="project-heading">
      <RouterLink to="/" class="back-link">← Meus projetos</RouterLink>
      <div class="page-title">
        <div>
          <p class="eyebrow">ESPAÇO DE ESCRITA</p>
          <h1>{{ p.titulo }}</h1>
          <p>{{ p.membros.map((m) => m.nome).join(" · ") }}</p>
        </div>
        <div class="row">
          <span
            class="save-status"
            role="status"
            :class="{ saved: status === 'Salvo' }"
            >● {{ status }}</span
          ><button class="secondary" @click="save">Salvar agora</button
          ><button
            v-for="action in actions"
            :key="action.id"
            :disabled="busy"
            class="secondary"
            @click="runAction(action)"
          >
            {{ busy ? "Preparando…" : action.rotulo }}
          </button>
        </div>
      </div>
    </div>
    <section v-if="draft" class="conflict">
      <h2>Rascunho recuperável encontrado</h2>
      <p>
        Última edição local:
        {{ new Date(draft.savedAt).toLocaleString("pt-BR") }}. Base: versão
        {{ draft.baseVersion }}; servidor: {{ p.versao }}.
      </p>
      <div class="row">
        <button @click="chooseDraft(true)">Recuperar rascunho</button
        ><button class="secondary" @click="chooseDraft(false)">
          Usar versão salva
        </button>
      </div>
    </section>
    <section v-if="remote" class="conflict" role="alert">
      <h2>Outro membro alterou o projeto</h2>
      <p>
        O salvamento automático está suspenso. Seu texto local permanece no
        editor. Compare as versões, concilie manualmente no editor se necessário
        e escolha como continuar.
      </p>
      <div class="compare">
        <details open>
          <summary>Seu texto local · versão {{ p.versao }}</summary>
          <div
            v-html="renderDocumento(p.texto, fontes, undefined, false)"
          ></div>
        </details>
        <details open>
          <summary>Texto no servidor · versão {{ remote.versao }}</summary>
          <div
            v-html="renderDocumento(remote.texto, fontes, undefined, false)"
          ></div>
        </details>
      </div>
      <div class="row">
        <button @click="resolveConflict(true)">
          Salvar minha versão conciliada</button
        ><button class="secondary" @click="resolveConflict(false)">
          Usar versão do servidor
        </button>
      </div>
    </section>
    <div v-if="!usuario" class="alert">
      Sua sessão expirou. Seu rascunho está preservado. Entre novamente na mesma
      conta para continuar.
    </div>
    <nav class="tabs" aria-label="Abas do projeto">
      <button
        v-for="[key, label] in [
          ['escrita', 'Escrita'],
          ['metadados', 'Dados do projeto'],
          ['fontes', 'Fontes'],
          ['arquivos', 'Arquivos'],
          ['reunioes', 'Reuniões'],
          ['membros', 'Membros'],
        ]"
        :key="key"
        :class="{ active: aba === key }"
        @click="switchTab(key)"
      >
        {{ label }}</button
      ><button
        v-for="tab in tabs"
        :key="tab.id"
        :class="{ active: aba === tab.id }"
        @click="switchTab(tab.id)"
      >
        {{ tab.rotulo }}
      </button>
    </nav>
    <section v-if="aba === 'escrita'" :class="{ 'editor-with-side': side }">
      <div>
        <div class="section-title">
          <span class="muted"
            >{{ count }} palavras · versão {{ p.versao }}</span
          >
          <div class="row">
            <button class="text-button" @click="preview = !preview">
              {{ preview ? "Voltar à edição" : "Prévia acadêmica" }}</button
            ><button
              v-if="tabs.length"
              class="text-button"
              @click="side = !side"
            >
              {{ side ? "Fechar referências" : "Abrir referências →" }}
            </button>
          </div>
        </div>
        <div
          v-if="preview"
          class="paper rich-output"
          v-html="
            renderDocumento(
              p.texto,
              fontes,
              (id) => `/api/projetos/${p!.id}/arquivos/${id}?inline=1`,
            )
          "
        ></div>
        <Editor
          v-else
          v-model="p.texto"
          :fontes="fontes"
          :arquivos="arquivos"
          :project-id="p.id"
        />
      </div>
      <aside v-if="side && tabs[0]">
        <component
          :is="tabs[0].component"
          :project-id="p.id"
          :fontes="fontes"
          @changed="refreshResources"
        />
      </aside>
    </section>
    <section v-else-if="aba === 'metadados'" class="card">
      <label
        >Título em português<input
          v-model="p.titulo"
          maxlength="300"
          required /></label
      ><label
        >Título em inglês<input v-model="p.tituloIngles" maxlength="300"
      /></label>
      <h2>Resumo</h2>
      <Editor v-model="p.resumo" limited label="Resumo em português" /><label
        >Palavras-chave, separadas por ponto e vírgula<input
          :value="p.palavrasChave.join('; ')"
          @change="
            p.palavrasChave = ($event.target as HTMLInputElement).value
              .split(';')
              .map((x) => x.trim())
              .filter(Boolean)
          "
      /></label>
      <h2>Abstract</h2>
      <Editor v-model="p.resumoIngles" limited label="Abstract" /><label
        >Keywords, separadas por ponto e vírgula<input
          :value="p.palavrasChaveIngles.join('; ')"
          @change="
            p.palavrasChaveIngles = ($event.target as HTMLInputElement).value
              .split(';')
              .map((x) => x.trim())
              .filter(Boolean)
          "
      /></label>
    </section>
    <Fontes
      v-else-if="aba === 'fontes'"
      :project-id="p.id"
      :items="fontes"
      @changed="refreshResources"
    /><Arquivos
      v-else-if="aba === 'arquivos'"
      :project-id="p.id"
      :items="arquivos"
      @changed="refreshResources"
    /><Reunioes v-else-if="aba === 'reunioes'" :project-id="p.id" /><Membros
      v-else-if="aba === 'membros'"
      :project="p"
      @changed="membersChanged"
    /><component
      :is="activeTab.component"
      v-else-if="activeTab"
      :project-id="p.id"
      :fontes="fontes"
      @changed="refreshResources"
    />
  </template>
</template>
