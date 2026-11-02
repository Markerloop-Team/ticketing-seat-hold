<script setup lang="ts">
import { computed, ref } from "vue";

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
const SIDE = 40;
const TOP = 78;
const BOTTOM = 24;

const groups = computed(() => new Map(props.priceGroups.map((g) => [g.id, g] as const)));
const tiers = computed(() => [...props.priceGroups].sort((a, b) => Number(b.price) - Number(a.price)));
const selectedSet = computed(() => new Set(selected.value));
const svgRoot = ref<SVGSVGElement | null>(null);
const hovered = ref<Seat | null>(null);

const box = computed(() => {
  const xs = props.seats.map((s) => s.x);
  const ys = props.seats.map((s) => s.y);
  const minX = Math.min(...xs) - SIDE;
  const maxX = Math.max(...xs) + SIDE;
  const seatTop = Math.min(...ys);
  const minY = seatTop - TOP;
  const width = maxX - minX;
  const height = Math.max(...ys) + BOTTOM - minY;
  return { minX, minY, width, height, seatTop, viewBox: `${minX} ${minY} ${width} ${height}` };
});

const stage = computed(() => {
  const { minX, width, seatTop } = box.value;
  const cx = minX + width / 2;
  const half = Math.min(width * 0.32, 150);
  const y = seatTop - 44;
  return {
    d: `M ${cx - half} ${y} Q ${cx} ${y + 16} ${cx + half} ${y}`,
    glow: `M ${cx - half} ${y} Q ${cx} ${y + 16} ${cx + half} ${y} L ${cx + half * 1.6} ${seatTop + 40} L ${cx - half * 1.6} ${seatTop + 40} Z`,
    x: cx,
    y: y - 12,
  };
});

const rows = computed(() => {
  const byRow = new Map<number, Seat[]>();
  for (const seat of props.seats) byRow.set(seat.row, [...(byRow.get(seat.row) ?? []), seat]);
  return [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, list]) => {
      const sorted = [...list].sort((a, b) => a.x - b.x);
      return { row, seats: sorted, first: sorted[0], last: sorted[sorted.length - 1] };
    });
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

/** Arrow keys walk the map: left/right along the row, up/down to the nearest seat in the next row. */
function move(seat: Seat, key: string) {
  const ri = rows.value.findIndex((r) => r.row === seat.row);
  const row = rows.value[ri];
  let target: Seat | undefined;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const i = row.seats.findIndex((s) => s.id === seat.id);
    target = row.seats[i + (key === "ArrowLeft" ? -1 : 1)];
  } else {
    const next = rows.value[ri + (key === "ArrowUp" ? -1 : 1)];
    target = next?.seats.reduce((best, s) => (Math.abs(s.x - seat.x) < Math.abs(best.x - seat.x) ? s : best));
  }
  if (target) svgRoot.value?.querySelector<SVGElement>(`[data-seat="${target.id}"]`)?.focus();
}

const tip = computed(() => {
  const seat = hovered.value;
  if (!seat) return null;
  const group = groups.value.get(seat.price_group);
  const s = state(seat);
  const hint = {
    free: props.disabled ? "Available" : "Click to add",
    selected: props.disabled ? "In your order" : "Click to remove",
    held: "Held by another buyer",
    sold: "Sold",
  }[s];
  const { minX, minY, width, height } = box.value;
  const pct = ((seat.x - minX) / width) * 100;
  return {
    seat,
    group,
    hint,
    state: s,
    // Anchor the bubble proportionally so it never spills past the map's edges.
    shift: `-${Math.min(90, Math.max(10, pct))}%`,
    left: `${pct}%`,
    top: `${((seat.y - SEAT_R - minY) / height) * 100}%`,
    below: seat.y - minY < 90,
  };
});
</script>

<template>
  <div class="seat-map">
    <ul class="legend" aria-label="Price tiers and seat states">
      <li v-for="group in tiers" :key="group.id" class="tier">
        <span class="dot" :style="{ background: group.color }" />
        <span class="tier-name">{{ group.name }}</span>
        <span class="tier-price">{{ formatPrice(group.price) }}</span>
      </li>
      <li class="state"><span class="dot is-selected" /> Your pick</li>
      <li class="state"><span class="dot is-held" /> Held</li>
      <li class="state"><span class="dot is-sold" /> Sold</li>
    </ul>

    <div
      class="canvas"
      :style="{ maxWidth: `calc(440px * ${box.width / box.height})` }"
      @mouseleave="hovered = null"
    >
      <svg
        ref="svgRoot"
        :viewBox="box.viewBox"
        role="group"
        aria-label="Seat map. Use Tab or the arrow keys to move between seats, Enter or Space to select."
      >
        <defs>
          <linearGradient id="sm-light" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f2d08f" stop-opacity="0.16" />
            <stop offset="1" stop-color="#f2d08f" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="stage.glow" fill="url(#sm-light)" />
        <path :d="stage.d" class="stage-arc" />
        <text class="stage-label" :x="stage.x" :y="stage.y">STAGE</text>

        <g v-for="r in rows" :key="r.row" class="row-labels" aria-hidden="true">
          <text :x="r.first.x - 24" :y="r.first.y">{{ r.row }}</text>
          <text :x="r.last.x + 24" :y="r.last.y">{{ r.row }}</text>
        </g>

        <g v-for="seat in seats" :key="seat.id" class="seat-wrap">
          <circle
            :data-seat="seat.id"
            :data-state="state(seat)"
            :cx="seat.x"
            :cy="seat.y"
            :r="SEAT_R"
            :style="{ fill: fill(seat) }"
            class="seat"
            :class="[state(seat), { locked: disabled }]"
            role="checkbox"
            :aria-checked="selectedSet.has(seat.id)"
            :aria-disabled="seat.status !== 'free' || disabled"
            :aria-label="label(seat)"
            :tabindex="seat.status === 'free' && !disabled ? 0 : -1"
            @click="toggle(seat)"
            @mouseenter="hovered = seat"
            @focus="hovered = seat"
            @blur="hovered = null"
            @keydown.enter.prevent="toggle(seat)"
            @keydown.space.prevent="toggle(seat)"
            @keydown.left.prevent="move(seat, 'ArrowLeft')"
            @keydown.right.prevent="move(seat, 'ArrowRight')"
            @keydown.up.prevent="move(seat, 'ArrowUp')"
            @keydown.down.prevent="move(seat, 'ArrowDown')"
          />
          <path
            v-if="state(seat) === 'selected'"
            class="check"
            :d="`M ${seat.x - 4} ${seat.y + 0.5} l 2.8 2.8 l 5.2 -5.6`"
          />
          <path
            v-else-if="seat.status === 'sold'"
            class="cross"
            :d="`M ${seat.x - 3} ${seat.y - 3} l 6 6 M ${seat.x + 3} ${seat.y - 3} l -6 6`"
          />
        </g>
      </svg>

      <div
        v-if="tip"
        class="tip"
        :class="[`is-${tip.state}`, { below: tip.below }]"
        :style="{ left: tip.left, top: tip.top, '--tx': tip.shift }"
        aria-hidden="true"
      >
        <p class="tip-seat">Row {{ tip.seat.row }} · Seat {{ tip.seat.number }}</p>
        <p class="tip-tier">
          <span class="dot" :style="{ background: tip.group?.color }" />
          {{ tip.group?.name }}
          <strong>{{ tip.group ? formatPrice(tip.group.price) : "" }}</strong>
        </p>
        <p class="tip-hint">{{ tip.hint }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 18px;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--muted);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
}
.tier-name {
  color: var(--text);
  font-weight: 600;
}
.tier-price {
  font-variant-numeric: tabular-nums;
}
.dot {
  display: inline-block;
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.dot.is-selected {
  background: #fff6e3;
  box-shadow: 0 0 0 2px var(--accent);
}
.dot.is-held {
  border: 1.5px dashed var(--muted);
}
.dot.is-sold {
  background: var(--seat-unavailable);
}

.canvas {
  position: relative;
  margin: 0 auto;
}
svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.stage-arc {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px rgba(227, 178, 90, 0.7));
}
.stage-label {
  fill: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5em;
  text-anchor: middle;
}
.row-labels text {
  fill: var(--faint);
  font-size: 10px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}

.seat {
  stroke: transparent;
  stroke-width: 2;
  transform-box: fill-box;
  transform-origin: center;
  transition:
    transform 0.18s var(--ease),
    stroke 0.15s,
    fill 0.2s,
    opacity 0.2s;
  outline: none;
}
.seat.free {
  cursor: pointer;
}
.seat.free:not(.locked):hover,
.seat.free:not(.locked):focus-visible {
  transform: scale(1.3);
  stroke: #fff;
}
.seat:focus-visible {
  stroke: #fff;
  stroke-width: 2.5;
}
.seat.free.locked {
  opacity: 0.35;
  cursor: default;
}
.seat.held {
  fill: transparent;
  stroke: rgba(255, 255, 255, 0.35);
  stroke-width: 1.5;
  stroke-dasharray: 3 2.5;
}
.seat.sold {
  fill: var(--seat-unavailable);
}
.seat.selected {
  fill: #fff6e3;
  stroke: var(--accent);
  stroke-width: 3;
  cursor: pointer;
  filter: drop-shadow(0 0 6px rgba(227, 178, 90, 0.85));
  animation: pop 0.35s var(--ease);
}
.seat.selected.locked {
  cursor: default;
}
.check {
  fill: none;
  stroke: #2a1d08;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.cross {
  stroke: rgba(255, 255, 255, 0.18);
  stroke-width: 1.3;
  stroke-linecap: round;
  pointer-events: none;
}
@keyframes pop {
  0% {
    transform: scale(0.6);
  }
  60% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}

.tip {
  position: absolute;
  z-index: 5;
  min-width: 168px;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: rgba(23, 20, 29, 0.96);
  box-shadow: 0 18px 40px -12px rgba(0, 0, 0, 0.7);
  transform: translate(var(--tx, -50%), calc(-100% - 10px));
  pointer-events: none;
  backdrop-filter: blur(8px);
  animation: tip-in 0.14s var(--ease);
}
.tip.below {
  transform: translate(var(--tx, -50%), 34px);
}
.tip p {
  white-space: nowrap;
}
.tip-seat {
  font-weight: 700;
  font-size: 14px;
}
.tip-tier {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}
.tip-tier strong {
  margin-left: auto;
  padding-left: 10px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.tip-hint {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  color: var(--accent-2);
}
.tip.is-held .tip-hint,
.tip.is-sold .tip-hint {
  color: var(--danger);
}
@keyframes tip-in {
  from {
    opacity: 0;
  }
}
</style>
