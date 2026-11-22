<script setup lang="ts">
import { ref, computed } from "vue";
import {
  dias,
  horario,
  type AtividadeDTO,
} from "../../../../packages/shared/src/index.js";
const props = defineProps<{ items: AtividadeDTO[] }>();
const emit = defineEmits<{
  select: [value: { dia: number; inicio: number; fim: number }];
  edit: [item: AtividadeDTO];
}>();
const start = ref<{ dia: number; slot: number } | null>(null),
  end = ref(0);
function finish() {
  if (start.value) {
    emit("select", {
      dia: start.value.dia,
      inicio: Math.min(start.value.slot, end.value) * 15,
      fim: (Math.max(start.value.slot, end.value) + 1) * 15,
    });
    start.value = null;
  }
}
const positions = computed(() => {
  const map = new Map<string, { left: number; width: number }>();
  for (let day = 0; day < 7; day++) {
    const events = props.items
      .filter((a) => a.dia === day)
      .sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
    let group: AtividadeDTO[] = [],
      until = -1;
    const layout = () => {
      const ends: number[] = [];
      const columns = new Map<string, number>();
      for (const e of group) {
        let col = ends.findIndex((v) => v <= e.inicio);
        if (col < 0) col = ends.length;
        ends[col] = e.fim;
        columns.set(e.id, col);
      }
      for (const e of group)
        map.set(e.id, {
          left: (columns.get(e.id)! / ends.length) * 100,
          width: 100 / ends.length,
        });
    };
    for (const e of events) {
      if (e.inicio >= until) {
        layout();
        group = [];
        until = -1;
      }
      group.push(e);
      until = Math.max(until, e.fim);
    }
    layout();
  }
  return map;
});
</script>
<template>
  <div class="schedule-scroll">
    <div class="schedule-head">
      <span>Horário</span><b v-for="d in dias" :key="d">{{ d }}</b>
    </div>
    <div class="schedule-body">
      <div class="time-axis">
        <div v-for="hour in 24" :key="hour">
          {{ String(hour - 1).padStart(2, "0") }}:00
        </div>
      </div>
      <div
        v-for="(_, day) in dias"
        :key="day"
        class="day-column"
        @pointerleave="() => {}"
      >
        <div
          v-for="slot in 96"
          :key="slot"
          class="time-slot"
          :class="{
            selected:
              start?.dia === day &&
              slot - 1 >= Math.min(start.slot, end) &&
              slot - 1 <= Math.max(start.slot, end),
          }"
          @pointerdown.prevent="
            start = { dia: day, slot: slot - 1 };
            end = slot - 1;
          "
          @pointerenter="start?.dia === day && (end = slot - 1)"
          @pointerup="finish"
        ></div>
        <button
          v-for="a in items.filter((a) => a.dia === day)"
          :key="a.id"
          class="schedule-event"
          :class="{ meeting: a.projeto_id }"
          :style="{
            top: (a.inicio / 15) * 12 + 'px',
            height: ((a.fim - a.inicio) / 15) * 12 + 'px',
            left: positions.get(a.id)?.left + '%',
            width: positions.get(a.id)?.width + '%',
          }"
          :title="`${a.descricao}: ${horario(a.inicio)}–${horario(a.fim)}`"
          @pointerdown.stop
          @click="emit('edit', a)"
        >
          <b>{{ a.descricao }}</b
          ><small>{{ horario(a.inicio) }}–{{ horario(a.fim) }}</small
          ><small v-if="a.projeto_id">Reunião · {{ a.projeto_titulo }}</small>
        </button>
      </div>
    </div>
    <div class="schedule-end">24:00</div>
  </div>
</template>
