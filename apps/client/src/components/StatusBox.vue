<script setup lang="ts">
defineProps<{ error?: string; loading?: boolean; empty?: boolean }>();
</script>
<template>
  <p v-if="loading" role="status" class="empty">Carregando…</p>
  <div v-else-if="error" class="alert" role="alert">
    {{ error }}<slot name="retry" />
  </div>
  <div v-else-if="empty" class="empty">
    <slot>Nenhum item por aqui ainda.</slot>
  </div>
</template>
