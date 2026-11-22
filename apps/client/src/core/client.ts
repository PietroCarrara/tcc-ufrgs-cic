import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "../App.vue";
import { router } from "./router.js";
import { RegistroDeModulos } from "./registry.js";
import { catalog, options } from "./catalog.generated.js";
import { api, restaurar, usuario } from "./http.js";
import { useApp } from "./state.js";
export class Cliente {
  registro = new RegistroDeModulos(router);
  private app = createApp(App);
  get sessao() {
    return usuario.value;
  }
  async inicializar() {
    const cap = await api("/api/capabilities");
    if (cap.apiVersion !== 1)
      throw new Error(
        "Atualize o cliente: protocolo incompatível com o servidor",
      );
    this.registro.capabilities = cap.modules;
    this.registro.inicializar(catalog, options);
    await restaurar();
    this.app.use(createPinia());
    useApp().capabilities = cap;
    this.app.provide("registro", this.registro);
    this.app.use(router);
    await router.isReady();
    return this;
  }
  servir() {
    this.app.mount("#app");
  }
}
