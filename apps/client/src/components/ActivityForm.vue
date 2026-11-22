<script setup lang="ts">
import { reactive, watch } from "vue";
import {
  dias,
  horario,
  type Intervalo,
} from "../../../../packages/shared/src/index.js";
const props = defineProps<{ value: Intervalo; busy?: boolean }>();
const emit = defineEmits<{ save: [value: Intervalo]; cancel: [] }>();
const data = reactive({ ...props.value });
watch(
  () => props.value,
  (v) => Object.assign(data, v),
);
</script>
<template>
  <form @submit.prevent="emit('save', { ...data })">
    <label
      >Descrição<input v-model="data.descricao" required maxlength="2000"
    /></label>
    <div class="form-grid">
      <label
        >Dia<select v-model="data.dia">
          <option v-for="(d, i) in dias" :key="d" :value="i">{{ d }}</option>
        </select></label
      ><label
        >Início<select v-model="data.inicio">
          <option v-for="n in 96" :key="n" :value="(n - 1) * 15">
            {{ horario((n - 1) * 15) }}
          </option>
        </select></label
      ><label
        >Fim<select v-model="data.fim">
          <option v-for="n in 96" :key="n" :value="n * 15">
            {{ horario(n * 15) }}
          </option>
        </select></label
      >
    </div>
    <p class="muted">
      Atividades semanais, em intervalos de 15 minutos. Divida atividades que
      atravessam meia-noite.
    </p>
    <div class="row">
      <button :disabled="busy">Salvar horário</button
      ><button type="button" class="secondary" @click="emit('cancel')">
        Cancelar
      </button>
    </div>
  </form>
</template>
