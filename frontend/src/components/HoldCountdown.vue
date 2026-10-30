<script setup lang="ts">
import { computed, toRef } from "vue";

import { useCountdown } from "../composables/useCountdown";

const props = defineProps<{ deadline: number }>();
const emit = defineEmits<{ expired: [] }>();

const { remaining } = useCountdown(toRef(props, "deadline"), () => emit("expired"));

const text = computed(() => {
  const m = Math.floor(remaining.value / 60);
  const s = remaining.value % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});
</script>

<template>
  <div class="countdown" :class="{ urgent: remaining <= 60 }" role="timer" aria-live="off">
    Seats held for <strong>{{ text }}</strong>
  </div>
</template>

<style scoped>
.countdown {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.countdown strong {
  color: var(--text);
}
.urgent strong {
  color: var(--danger);
}
</style>
