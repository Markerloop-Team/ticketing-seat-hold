<script setup lang="ts">
import { computed } from "vue";

import type { SectionSummary } from "../api";
import { parsePlan } from "../lib/svg-plan";

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
    return { ...shape, section, available: (section?.available ?? 0) > 0 };
  });
});

function pick(section: SectionSummary | undefined) {
  if (section && section.available > 0) emit("select", section);
}
</script>

<template>
  <svg class="plan" :viewBox="plan.viewBox" role="group" aria-label="Venue plan">
    <g v-if="plan.stage">
      <rect class="stage" v-bind="plan.stage" rx="6" />
      <text
        class="stage-label"
        :x="plan.stage.x + plan.stage.width / 2"
        :y="plan.stage.y + plan.stage.height / 2"
      >
        STAGE
      </text>
    </g>
    <path
      v-for="shape in shapes"
      :key="shape.id"
      :d="shape.d"
      class="section"
      :class="{ available: shape.available, selected: shape.section?.id === selectedId }"
      role="button"
      :tabindex="shape.available ? 0 : -1"
      :aria-disabled="!shape.available"
      :aria-label="`${shape.section?.name ?? shape.id}: ${shape.section?.available ?? 0} available`"
      @click="pick(shape.section)"
      @keydown.enter.prevent="pick(shape.section)"
    />
  </svg>
</template>

<style scoped>
.plan {
  width: 100%;
  max-height: 340px;
}
.stage {
  fill: var(--text);
}
.stage-label {
  fill: var(--bg);
  font-size: 14px;
  letter-spacing: 0.2em;
  text-anchor: middle;
  dominant-baseline: middle;
}
.section {
  fill: var(--seat-unavailable);
  stroke: var(--surface);
  stroke-width: 2;
  opacity: 0.6;
  transition: fill 0.15s;
}
.section.available {
  fill: color-mix(in srgb, var(--accent) 25%, var(--surface));
  opacity: 1;
  cursor: pointer;
}
.section.available:hover,
.section.available:focus-visible {
  fill: color-mix(in srgb, var(--accent) 45%, var(--surface));
  outline: none;
}
.section.selected {
  fill: var(--accent);
}
</style>
