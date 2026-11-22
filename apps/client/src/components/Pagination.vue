<script setup lang="ts">
defineProps<{ page: number; total: number; limit?: number }>();
defineEmits<{ change: [page: number] }>();
</script>
<template>
  <nav v-if="total > (limit ?? 20)" class="pagination" aria-label="Paginação">
    <button
      class="secondary"
      :disabled="page <= 1"
      @click="$emit('change', page - 1)"
    >
      Anterior</button
    ><span>Página {{ page }} · {{ total }} itens</span
    ><button
      class="secondary"
      :disabled="page * (limit ?? 20) >= total"
      @click="$emit('change', page + 1)"
    >
      Próxima
    </button>
  </nav>
</template>
