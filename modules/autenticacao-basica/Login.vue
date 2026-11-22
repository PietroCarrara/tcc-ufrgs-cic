<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { enviar, usuario, csrf } from "../../apps/client/src/core/http.js";
const email = ref(""),
  senha = ref(""),
  erro = ref(""),
  busy = ref(false),
  router = useRouter();
async function login() {
  busy.value = true;
  erro.value = "";
  try {
    const r = await enviar("/api/login", {
      email: email.value,
      senha: senha.value,
    });
    usuario.value = r.usuario;
    csrf.value = r.csrf;
    senha.value = "";
    await router.push("/");
  } catch (e) {
    erro.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="login-layout">
    <div>
      <p class="eyebrow">BEM-VINDO DE VOLTA</p>
      <h1>Seu próximo capítulo<br />começa aqui.</h1>
      <p class="lead">
        Entre para continuar escrevendo, organizar suas fontes e conversar com
        suas ideias.
      </p>
    </div>
    <form class="card login-card" @submit.prevent="login">
      <h2>Entrar no Trama</h2>
      <p>Use a conta fornecida pela sua instituição.</p>
      <label
        >E-mail<input
          v-model="email"
          type="email"
          autocomplete="username"
          required
          maxlength="254" /></label
      ><label
        >Senha<input
          v-model="senha"
          type="password"
          autocomplete="current-password"
          required
          maxlength="128"
      /></label>
      <p v-if="erro" class="alert" role="alert">{{ erro }}</p>
      <button :disabled="busy">{{ busy ? "Entrando…" : "Entrar" }}</button
      ><small
        >Precisa de uma conta ou redefinir a senha? Procure o operador da
        instalação.</small
      >
    </form>
  </section>
</template>
