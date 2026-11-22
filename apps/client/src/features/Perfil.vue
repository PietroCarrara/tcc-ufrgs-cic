<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, enviar, usuario } from "../core/http.js";
import { vazio } from "../../../../packages/shared/src/index.js";
import Editor from "../components/Editor.vue";
const perfil = ref<any>(null),
  error = ref(""),
  success = ref(""),
  photoVersion = ref(0);
async function load() {
  try {
    perfil.value = await api("/api/me");
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function save() {
  error.value = "";
  try {
    const body = {
      nome: perfil.value.nome,
      ...(usuario.value?.papel === "professor"
        ? {
            biografia: perfil.value.biografia,
            sugestoes: perfil.value.sugestoes,
          }
        : {}),
    };
    perfil.value = await enviar("/api/me", body, "PATCH");
    usuario.value = { ...usuario.value!, nome: perfil.value.nome };
    success.value = "Perfil atualizado.";
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function photo(event: Event) {
  const f = (event.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const data = new FormData();
  data.append("arquivo", f);
  try {
    perfil.value = await api("/api/me/foto", { method: "PUT", body: data });
    photoVersion.value++;
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function removePhoto() {
  try {
    await enviar("/api/me/foto", {}, "DELETE");
    perfil.value.foto = false;
  } catch (e) {
    error.value = (e as Error).message;
  }
}
onMounted(load);
</script>
<template>
  <div class="page-title">
    <div>
      <p class="eyebrow">SUA PRESENÇA NA PESQUISA</p>
      <h1>Meu perfil<span class="accent">.</span></h1>
    </div>
  </div>
  <p v-if="error" class="alert" role="alert">{{ error }}</p>
  <p v-if="success" class="success" role="status">{{ success }}</p>
  <section v-if="perfil" class="card profile">
    <div class="row">
      <img
        v-if="perfil.foto"
        class="avatar large"
        :src="`/api/usuarios/${perfil.id}/foto?v=${photoVersion}`"
        alt="Sua foto de perfil"
      /><span v-else class="avatar large">{{ perfil.nome[0] }}</span
      ><label
        >Foto de perfil · PNG, JPEG ou WebP, até 2 MiB<input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          @change="photo" /></label
      ><button v-if="perfil.foto" class="text-button" @click="removePhoto">
        Remover foto
      </button>
    </div>
    <form @submit.prevent="save">
      <label>Nome<input v-model="perfil.nome" required maxlength="150" /></label
      ><label>E-mail<input :value="perfil.email" disabled /></label>
      <p class="muted">Perfil: {{ perfil.papel }}</p>
      <template v-if="perfil.papel === 'professor'">
        <h2>Biografia</h2>
        <Editor v-model="perfil.biografia" limited label="Biografia" />
        <h2>Sugestões de pesquisa</h2>
        <div
          v-for="(_suggestion, i) in perfil.sugestoes"
          :key="i"
          class="suggestion"
        >
          <Editor
            v-model="perfil.sugestoes[i]"
            limited
            :label="`Sugestão ${Number(i) + 1}`"
          /><button
            type="button"
            class="text-button danger-text"
            @click="perfil.sugestoes.splice(i, 1)"
          >
            Remover sugestão
          </button>
        </div>
        <button
          type="button"
          class="secondary"
          @click="perfil.sugestoes.push(vazio())"
        >
          + Sugestão
        </button>
      </template>
      <p><button>Salvar perfil</button></p>
    </form>
  </section>
</template>
