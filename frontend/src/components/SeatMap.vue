<script setup lang="ts">
import { computed } from "vue";

import type { PriceGroup, Seat } from "../api";
import { formatPrice } from "../lib/format";

const props = withDefaults(
  defineProps<{
    seats: Seat[];
    priceGroups: PriceGroup[];
    maxSelected?: number;
    disabled?: boolean;
  }>(),
  { maxSelected: 5, disabled: false },
);
const selected = defineModel<number[]>("selected", { default: () => [] });
const emit = defineEmits<{ limit: [max: number] }>();

const SEAT_R = 9;
const PAD = 28;

const groups = computed(() => new Map(props.priceGroups.map((g) => [g.id, g] as const)));
const selectedSet = computed(() => new Set(selected.value));

const box = computed(() => {
  const xs = props.seats.map((s) => s.x);
  const ys = props.seats.map((s) => s.y);
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  return {
    minX,
    minY,
    viewBox: `${minX} ${minY} ${Math.max(...xs) - minX + PAD} ${Math.max(...ys) - minY + PAD}`,
  };
});

const rows = computed(() => {
  const firstSeat = new Map<number, Seat>();
  for (const seat of props.seats) {
    const cur = firstSeat.get(seat.row);
    if (!cur || seat.x < cur.x) firstSeat.set(seat.row, seat);
  }
  return [...firstSeat.values()].map((s) => ({ row: s.row, y: s.y }));
});

function state(seat: Seat): "selected" | "free" | "held" | "sold" {
  return selectedSet.value.has(seat.id) ? "selected" : seat.status;
}

function fill(seat: Seat): string | undefined {
  return state(seat) === "free" ? groups.value.get(seat.price_group)?.color : undefined;
}

function label(seat: Seat): string {
  const group = groups.value.get(seat.price_group);
  const price = group ? `, ${group.name} ${formatPrice(group.price)}` : "";
  return `Row ${seat.row}, seat ${seat.number}${price}${seat.status === "free" ? "" : `, ${seat.status}`}`;
}

function toggle(seat: Seat) {
  if (props.disabled || seat.status !== "free") return;
  if (selectedSet.value.has(seat.id)) {
    selected.value = selected.value.filter((id) => id !== seat.id);
  } else if (selected.value.length >= props.maxSelected) {
    emit("limit", props.maxSelected);
  } else {
    selected.value = [...selected.value, seat.id];
  }
}
</script>

<template>
  <div class="seat-map">
    <ul class="legend">
      <li v-for="group in priceGroups" :key="group.id">
        <span class="swatch" :style="{ background: group.color }" />
        {{ group.name }} · {{ formatPrice(group.price) }}
      </li>
      <li><span class="swatch unavailable" /> Taken</li>
    </ul>

    <svg :viewBox="box.viewBox" role="group" aria-label="Seat map">
      <text
        v-for="r in rows"
        :key="r.row"
        class="row-label"
        :x="box.minX + 6"
        :y="r.y"
      >
        {{ r.row }}
      </text>
      <circle
        v-for="seat in seats"
        :key="seat.id"
        :data-seat="seat.id"
        :data-state="state(seat)"
        :cx="seat.x"
        :cy="seat.y"
        :r="SEAT_R"
        :style="{ fill: fill(seat) }"
        class="seat"
        :class="state(seat)"
        role="checkbox"
        :aria-checked="selectedSet.has(seat.id)"
        :aria-disabled="seat.status !== 'free' || disabled"
        :aria-label="label(seat)"
        :tabindex="seat.status === 'free' && !disabled ? 0 : -1"
        @click="toggle(seat)"
        @keydown.enter.prevent="toggle(seat)"
        @keydown.space.prevent="toggle(seat)"
      >
        <title>{{ label(seat) }}</title>
      </circle>
    </svg>
  </div>
</template>

<style scoped>
.seat-map svg {
  width: 100%;
  max-height: 420px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--muted);
}
.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border-radius: 50%;
}
.swatch.unavailable {
  background: var(--seat-unavailable);
}
.row-label {
  font-size: 10px;
  fill: var(--muted);
  dominant-baseline: middle;
}
.seat {
  stroke: transparent;
  stroke-width: 3;
  transition:
    transform 0.1s,
    stroke 0.1s;
  transform-box: fill-box;
  transform-origin: center;
}
.seat:focus {
  outline: none;
}
.seat.free {
  cursor: pointer;
}
.seat.free:hover,
.seat.free:focus-visible {
  transform: scale(1.2);
}
.seat:focus-visible {
  stroke: var(--accent);
}
.seat.held,
.seat.sold {
  fill: var(--seat-unavailable);
}
.seat.held {
  fill-opacity: 0.6;
}
.seat.selected {
  fill: var(--text);
  stroke: var(--accent);
  cursor: pointer;
}
</style>
