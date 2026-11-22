import { defineStore } from "pinia";
import { ref } from "vue";
import { api, usuario } from "./http.js";
export const useApp = defineStore("app", () => {
  const naoLidas = ref(0);
  const capabilities = ref<{
    timezone: string;
    buscaConfigurada: boolean;
    limites: { upload: number; foto: number; arquivosProjeto: number };
  }>({
    timezone: "America/Sao_Paulo",
    buscaConfigurada: false,
    limites: { upload: 10485760, foto: 2097152, arquivosProjeto: 104857600 },
  });
  async function atualizar() {
    if (!usuario.value) {
      naoLidas.value = 0;
      return;
    }
    try {
      const n = await api("/api/notificacoes?limite=1");
      naoLidas.value = n.naoLidas;
    } catch {
      /* A tela ativa apresenta expiração da sessão. */
    }
  }
  return { naoLidas, capabilities, atualizar };
});
