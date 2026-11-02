<script setup lang="ts">
import { computed } from "vue";

import type { SectionSummary } from "../api";
import { parsePlan, pathCentre } from "../lib/svg-plan";

const props = defineProps<{
  svg: string;
  sections: SectionSummary[];
  selectedId: number | null;
}>();
const emit = defineEmits<{ select: [section: SectionSummary] }>();

const plan = computed(() => parsePlan(props.svg));
const shapes = computed(() => {
  const byElementId = new Map(props.sections.map((s) => [s.svg_element_id, s] as const));
  return plan.value.shapes.map((shape) => {
    const section = byElementId.get(shape.id);
    return {
      ...shape,
      section,
      centre: pathCentre(shape.d),
      available: (section?.available ?? 0) > 0,
    };
  });
});

function shortName(name: string) {
  return name.replace(/^Balcony /, "").replace(/ Balcony$/, "");
}

function pick(section: SectionSummary | undefined) {
  if (section && section.available > 0) emit("select", section);
}
</script>

<template>
  <svg class="plan" :viewBox="plan.viewBox" role="group" aria-label="Venue plan: choose a section">
    <defs>
      <linearGradient id="vp-stage" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9b1f3c" />
        <stop offset="1" stop-color="#4a0d1e" />
      </linearGradient>
      <radialGradient id="vp-light" cx="0.5" cy="0" r="0.9">
        <stop offset="0" stop-color="#f2d08f" stop-opacity="0.12" />
        <stop offset="1" stop-color="#f2d08f" stop-opacity="0" />
      </radialGradient>
    </defs>
    <g v-if="plan.stage">
      <ellipse
        :cx="plan.stage.x + plan.stage.width / 2"
        :cy="plan.stage.y + plan.stage.height"
        :rx="plan.stage.width * 0.9"
        :ry="110"
        fill="url(#vp-light)"
      />
      <rect class="stage" v-bind="plan.stage" rx="6" fill="url(#vp-stage)" />
      <text
        class="stage-label"
        :x="plan.stage.x + plan.stage.width / 2"
        :y="plan.stage.y + plan.stage.height / 2"
      >
        STAGE
      </text>
    </g>
    <g
      v-for="shape in shapes"
      :key="shape.id"
      class="section"
      :class="{ available: shape.available, selected: shape.section?.id === selectedId }"
      role="button"
      :tabindex="shape.available ? 0 : -1"
      :aria-disabled="!shape.available"
      :aria-pressed="shape.section?.id === selectedId"
      :aria-label="`${shape.section?.name ?? shape.id}: ${shape.section?.available ?? 0} available`"
      @click="pick(shape.section)"
      @keydown.enter.prevent="pick(shape.section)"
      @keydown.space.prevent="pick(shape.section)"
    >
      <path :d="shape.d" class="shape" />
      <text class="name" :x="shape.centre.x" :y="shape.centre.y - 4">
        {{ shortName(shape.section?.name ?? shape.id) }}
      </text>
      <text class="count" :x="shape.centre.x" :y="shape.centre.y + 20">
        {{ shape.section?.available ?? 0 }} left
      </text>
    </g>
  </svg>
</template>

<style scoped>
.plan {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.stage-label {
  fill: #ffe9c2;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.4em;
  text-anchor: middle;
  dominant-baseline: middle;
}
.section {
  outline: none;
}
.shape {
  fill: rgba(255, 255, 255, 0.03);
  stroke: rgba(255, 255, 255, 0.12);
  stroke-width: 1.5;
  transition:
    fill 0.2s,
    stroke 0.2s;
}
.section.available {
  cursor: pointer;
}
.section.available .shape {
  fill: rgba(227, 178, 90, 0.07);
  stroke: rgba(227, 178, 90, 0.35);
}
.section.available:hover .shape,
.section.available:focus-visible .shape {
  fill: rgba(227, 178, 90, 0.16);
  stroke: var(--accent);
}
.section:focus-visible .shape {
  stroke-width: 3;
}
.section.selected .shape {
  fill: rgba(227, 178, 90, 0.26);
  stroke: var(--accent-2);
  stroke-width: 2;
  filter: drop-shadow(0 0 14px rgba(227, 178, 90, 0.45));
}
text {
  pointer-events: none;
  text-anchor: middle;
}
.name {
  fill: var(--text);
  font-family: var(--serif);
  font-size: 30px;
  font-weight: 600;
}
.count {
  fill: var(--muted);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.section.selected .count {
  fill: var(--accent-2);
}
</style>
