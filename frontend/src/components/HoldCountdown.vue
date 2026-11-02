<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";

import { useCountdown } from "../composables/useCountdown";

const props = defineProps<{ deadline: number }>();
const emit = defineEmits<{ expired: [] }>();

const { remaining } = useCountdown(toRef(props, "deadline"), () => emit("expired"));

// The ring is drawn against the length of the hold as first seen for this deadline.
const span = ref(Math.max(1, remaining.value));
watch(
  () => props.deadline,
  () => (span.value = Math.max(1, Math.ceil((props.deadline - Date.now()) / 1000))),
);

const text = computed(() => {
  const m = Math.floor(remaining.value / 60);
  const s = remaining.value % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});

const R = 44;
const C = 2 * Math.PI * R;
const offset = computed(() => C * (1 - Math.min(1, remaining.value / span.value)));
</script>

<template>
  <div class="countdown" :class="{ urgent: remaining <= 60 }" role="timer" aria-live="off">
    <div class="dial">
    <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle class="track" cx="50" cy="50" :r="R" />
      <circle
        class="progress"
        cx="50"
        cy="50"
        :r="R"
        :stroke-dasharray="C"
        :stroke-dashoffset="offset"
      />
    </svg>
    <div class="face">
      <strong>{{ text }}</strong>
      <span>left</span>
    </div>
    </div>
    <div class="caption">
      <span class="sr-only">Seats held for {{ text }}.</span>
      <slot>Seats held for you</slot>
    </div>
  </div>
</template>

<style scoped>
.countdown {
  position: relative;
  display: grid;
  grid-template-columns: 92px 1fr;
  align-items: center;
  gap: 16px;
}
.dial {
  position: relative;
  width: 92px;
  height: 92px;
}
.ring {
  display: block;
  width: 92px;
  height: 92px;
  transform: rotate(-90deg);
}
.track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 6;
}
.progress {
  fill: none;
  stroke: var(--accent);
  stroke-width: 6;
  stroke-linecap: round;
  transition:
    stroke-dashoffset 0.25s linear,
    stroke 0.3s;
}
.face {
  position: absolute;
  top: 0;
  left: 0;
  width: 92px;
  height: 92px;
  display: grid;
  place-content: center;
  text-align: center;
  line-height: 1.1;
}
.face strong {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
.face span {
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.caption {
  color: var(--muted);
  font-size: 14px;
}
.urgent .progress {
  stroke: var(--danger);
}
.urgent .face strong {
  color: var(--danger);
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.55;
  }
}
</style>
