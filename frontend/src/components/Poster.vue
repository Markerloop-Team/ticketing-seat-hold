<script setup lang="ts">
// Original artwork drawn in SVG for this demo: one gold line motif per production
// over a night-sky gradient, in the style of the first Swan Lake poster.
import { computed, useId } from "vue";

import type { Production } from "../content/programme";

const props = defineProps<{ production: Production; bare?: boolean }>();

const uid = useId().replace(/[^\w-]/g, "");
const id = (name: string) => `${name}-${uid}`;
const url = (name: string) => `url(#${id(name)})`;

const art = computed(() => props.production.poster);
const lines = computed(() => art.value.lines ?? [props.production.title]);
const titleSize = computed(() => {
  const longest = Math.max(...lines.value.map((l) => l.length));
  return longest <= 10 ? 40 : longest <= 12 ? 34 : 27;
});
const titleY = computed(() =>
  lines.value.length > 1 ? [376 - titleSize.value * 0.95, 376] : [378],
);
const sub = computed(() => {
  const company = props.production.company.toUpperCase();
  return company.length <= 18 ? `${company} · SEASON 26/27` : company;
});

/** Where the warm light sits behind each motif, and where the floor starts. */
const scene = computed(
  () =>
    ({
      swan: { glow: [186, 150], floor: 268 },
      nutcracker: { glow: [150, 160], floor: 296 },
      balcony: { glow: [200, 120], floor: 292 },
      camellia: { glow: [150, 168], floor: 300 },
      fan: { glow: [150, 210], floor: 300 },
      letter: { glow: [150, 180], floor: 290 },
      jazz: { glow: [196, 112], floor: 300 },
      mic: { glow: [150, 160], floor: 296 },
    })[art.value.motif],
);

const stars = [
  [40, 48, 0.9],
  [78, 96, 0.6],
  [252, 40, 0.8],
  [226, 118, 0.6],
  [132, 30, 0.5],
  [270, 170, 0.7],
  [24, 160, 0.6],
  [60, 220, 0.5],
];

const snow = [
  [58, 84],
  [242, 64],
  [96, 200],
  [222, 176],
  [36, 250],
  [266, 238],
  [196, 104],
  [82, 136],
];
const flake = (x: number, y: number, r = 4) =>
  `M${x - r} ${y}h${2 * r}M${x} ${y - r}v${2 * r}M${x - r * 0.7} ${y - r * 0.7}l${r * 1.4} ${r * 1.4}M${x + r * 0.7} ${y - r * 0.7}l${-r * 1.4} ${r * 1.4}`;

// Carmen's fan: pleats between ribs from the pivot.
const fan = computed(() => {
  const cx = 150;
  const cy = 262;
  const p = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const ribs = Array.from({ length: 11 }, (_, i) => 18 + i * 14.4);
  const pleats = ribs.slice(0, -1).map((a, i) => {
    const b = ribs[i + 1];
    const [x1, y1] = p(46, a);
    const [x2, y2] = p(124, a);
    const [x3, y3] = p(124, b);
    const [x4, y4] = p(46, b);
    return { d: `M${x1} ${y1}L${x2} ${y2}A124 124 0 0 0 ${x3} ${y3}L${x4} ${y4}Z`, odd: i % 2 === 1 };
  });
  const ribLines = ribs.map((a) => {
    const [x1, y1] = p(14, a);
    const [x2, y2] = p(124, a);
    return `M${x1} ${y1}L${x2} ${y2}`;
  });
  return { pleats, ribLines };
});

const petals = (count: number, length: number, offset: number, turn = 0) =>
  Array.from({ length: count }, (_, i) => ({
    transform: `rotate(${(360 / count) * i + turn} 150 166)`,
    cy: 166 - offset,
    ry: length,
  }));

const keys = Array.from({ length: 12 }, (_, i) => 30 + i * 20);
const blackKeys = [0, 1, 3, 4, 5, 7, 8, 10].map((i) => 30 + i * 20 + 14);
</script>

<template>
  <svg
    class="poster"
    viewBox="0 0 300 420"
    preserveAspectRatio="xMidYMid slice"
    role="img"
    :aria-label="`Poster: ${production.title}`"
  >
    <defs>
      <linearGradient :id="id('sky')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="art.sky[0]" />
        <stop offset="0.55" :stop-color="art.sky[1]" />
        <stop offset="1" :stop-color="art.sky[2]" />
      </linearGradient>
      <radialGradient :id="id('moon')" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#fff3d6" />
        <stop offset="0.7" stop-color="#f2d08f" />
        <stop offset="1" stop-color="#e3b25a" stop-opacity="0" />
      </radialGradient>
      <radialGradient :id="id('glow')" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#f2d08f" stop-opacity="0.42" />
        <stop offset="1" stop-color="#f2d08f" stop-opacity="0" />
      </radialGradient>
      <linearGradient :id="id('gold')" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff1cf" />
        <stop offset="1" stop-color="#c8913a" />
      </linearGradient>
      <linearGradient :id="id('floor')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1b0f1f" stop-opacity="0.85" />
        <stop offset="1" stop-color="#07060a" />
      </linearGradient>
      <linearGradient :id="id('beam')" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff3d6" stop-opacity="0.5" />
        <stop offset="1" stop-color="#f2d08f" stop-opacity="0.04" />
      </linearGradient>
    </defs>

    <rect width="300" height="420" :fill="url('sky')" />
    <g opacity="0.55" fill="#fff">
      <circle v-for="([x, y, r], i) in stars" :key="i" :cx="x" :cy="y" :r="r" />
    </g>
    <circle :cx="scene.glow[0]" :cy="scene.glow[1]" r="124" :fill="url('glow')" />

    <!-- Swan Lake: a swan's neck over a moonlit lake -->
    <g v-if="art.motif === 'swan'">
      <circle cx="186" cy="150" r="58" :fill="url('moon')" />
      <rect y="268" width="300" height="152" :fill="url('floor')" />
      <g stroke="#f2d08f" stroke-linecap="round" opacity="0.5">
        <path d="M150 284h72" stroke-width="2" />
        <path d="M160 298h52" stroke-width="1.5" opacity="0.8" />
        <path d="M172 312h30" stroke-width="1.2" opacity="0.6" />
        <path d="M180 326h14" stroke-width="1" opacity="0.4" />
      </g>
      <path
        d="M58 268c22-4 60-6 92-4 18 1 30-6 34-18 5-16-6-30-12-46-7-20 2-44 22-48 14-3 26 6 26 18"
        fill="none"
        :stroke="url('gold')"
        stroke-width="5"
        stroke-linecap="round"
      />
      <path d="M220 120l14 4-12 6" fill="#e3b25a" />
      <path
        d="M58 268c18-26 52-44 88-40 22 2 30 18 34 30"
        fill="none"
        :stroke="url('gold')"
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.8"
      />
      <path
        d="M70 262c14-14 34-22 56-22"
        fill="none"
        :stroke="url('gold')"
        stroke-width="1.2"
        stroke-linecap="round"
        opacity="0.6"
      />
      <path
        d="M58 270c22 4 60 6 92 4"
        fill="none"
        stroke="#e3b25a"
        stroke-width="2"
        stroke-linecap="round"
        opacity="0.25"
      />
    </g>

    <template v-else>
      <rect :y="scene.floor" width="300" :height="420 - scene.floor" :fill="url('floor')" />
      <path
        :d="`M40 ${scene.floor + 0.5}h220`"
        stroke="#f2d08f"
        stroke-opacity="0.35"
        stroke-linecap="round"
      />
    </template>

    <!-- The Nutcracker: a toy soldier under a star, snow falling -->
    <g
      v-if="art.motif === 'nutcracker'"
      fill="none"
      :stroke="url('gold')"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="M150 42l4.5 11.5 12.5.5-9.8 7.8 3.4 12-10.6-7-10.6 7 3.4-12-9.8-7.8 12.5-.5z"
        fill="#f2d08f"
        stroke="none"
      />
      <path v-for="([x, y], i) in snow" :key="i" :d="flake(x, y, i % 2 ? 3 : 4.5)" stroke-width="1.2" opacity="0.75" />
      <path d="M128 168V118a22 9 0 0 1 44 0v50" stroke-width="3" />
      <path d="M128 156h44" stroke-width="2" />
      <path d="M150 109c-3-14 6-22 15-25" stroke-width="2.5" />
      <rect x="132" y="168" width="36" height="34" rx="8" stroke-width="3" />
      <circle cx="142" cy="181" r="1.8" fill="#f2d08f" stroke="none" />
      <circle cx="158" cy="181" r="1.8" fill="#f2d08f" stroke="none" />
      <path d="M138 192q6 6 12 0q6 6 12 0" stroke-width="2" />
      <path d="M122 206h56l-5 62h-46z" stroke-width="3" />
      <path d="M125 210l50 44" stroke-width="2" opacity="0.7" />
      <path d="M122 206q-12 4-13 18M178 206q12 4 13 18" stroke-width="3" />
      <path d="M109 224v36M191 224v36" stroke-width="3" />
      <circle cx="150" cy="226" r="2.2" fill="#f2d08f" stroke="none" />
      <circle cx="150" cy="244" r="2.2" fill="#f2d08f" stroke="none" />
      <path d="M137 268v26M163 268v26M129 294h14M157 294h14" stroke-width="3" />
    </g>

    <!-- Romeo and Juliet: the balcony under a crescent moon -->
    <g
      v-if="art.motif === 'balcony'"
      fill="none"
      :stroke="url('gold')"
      stroke-linecap="round"
    >
      <path d="M226 68a30 30 0 1 0 0 56a24 24 0 1 1 0-56z" :fill="url('moon')" stroke="none" />
      <path d="M104 292V180Q104 130 150 112Q196 130 196 180V292" stroke-width="3" />
      <path d="M118 236V184Q118 146 150 130Q182 146 182 184V236" stroke-width="1.2" opacity="0.55" />
      <path d="M80 236h140M80 248h140M76 282h148" stroke-width="2.5" />
      <path
        v-for="x in [90, 102, 114, 126, 138, 150, 162, 174, 186, 198, 210]"
        :key="x"
        :d="`M${x} 250v30`"
        stroke-width="1.6"
        opacity="0.8"
      />
      <path d="M228 292c12-30-10-52 6-84" stroke-width="1.8" />
      <path d="M232 256c10-4 18 0 20 8c-10 3-17 0-20-8zM230 228c-10-6-18-2-21 6c10 4 17 1 21-6z" :fill="url('gold')" stroke="none" opacity="0.6" />
      <circle cx="234" cy="206" r="7" fill="#c2283a" stroke="#f2d08f" stroke-width="1.2" />
    </g>

    <!-- La Traviata: a camellia -->
    <g v-if="art.motif === 'camellia'" :stroke="url('gold')" stroke-linecap="round">
      <path d="M150 206C144 236 162 262 150 300" fill="none" stroke-width="2.5" />
      <path d="M152 250c18-12 32-6 38 6c-14 9-29 7-38-6z" :fill="url('gold')" stroke="none" opacity="0.55" />
      <path d="M148 272c-16-8-28-2-32 8c13 6 26 3 32-8z" :fill="url('gold')" stroke="none" opacity="0.4" />
      <ellipse
        v-for="(pt, i) in petals(8, 30, 28)"
        :key="`o${i}`"
        cx="150"
        :cy="pt.cy"
        rx="17"
        :ry="pt.ry"
        :transform="pt.transform"
        :fill="art.sky[1]"
        fill-opacity="0.85"
        stroke-width="1.6"
      />
      <ellipse
        v-for="(pt, i) in petals(6, 18, 14, 30)"
        :key="`i${i}`"
        cx="150"
        :cy="pt.cy"
        rx="11"
        :ry="pt.ry"
        :transform="pt.transform"
        fill="#8c1630"
        stroke-width="1.4"
      />
      <circle cx="150" cy="166" r="7" fill="#f2d08f" stroke="none" />
      <ellipse cx="72" cy="248" rx="6" ry="11" transform="rotate(40 72 248)" fill="#8c1630" stroke-width="1" opacity="0.8" />
      <ellipse cx="236" cy="226" rx="5" ry="9" transform="rotate(-30 236 226)" fill="#8c1630" stroke-width="1" opacity="0.7" />
      <ellipse cx="218" cy="286" rx="5" ry="9" transform="rotate(70 218 286)" fill="#8c1630" stroke-width="1" opacity="0.6" />
    </g>

    <!-- Carmen: an open fan with a red rose -->
    <g v-if="art.motif === 'fan'" :stroke="url('gold')" stroke-linecap="round">
      <path
        v-for="(pl, i) in fan.pleats"
        :key="i"
        :d="pl.d"
        :fill="pl.odd ? '#f2d08f' : '#c2283a'"
        :fill-opacity="pl.odd ? 0.16 : 0.32"
        stroke-width="1"
      />
      <path v-for="(d, i) in fan.ribLines" :key="`r${i}`" :d="d" stroke-width="1.6" />
      <path d="M32 220A124 124 0 0 1 268 220" fill="none" stroke-width="0" />
      <circle cx="150" cy="262" r="16" fill="#c2283a" stroke-width="2" />
      <path d="M150 262m-8 0a8 8 0 1 1 8 8a5 5 0 1 1 -3-7" fill="none" stroke-width="1.6" />
      <path d="M140 276c-10 8-24 10-34 6c8-10 22-12 34-6z" :fill="url('gold')" stroke="none" opacity="0.6" />
    </g>

    <!-- The Government Inspector: a sealed letter and a quill -->
    <g v-if="art.motif === 'letter'" :stroke="url('gold')" stroke-linecap="round" stroke-linejoin="round">
      <rect x="80" y="152" width="140" height="94" rx="4" :fill="art.sky[1]" fill-opacity="0.7" stroke-width="3" />
      <path d="M80 156L150 206L220 156" fill="none" stroke-width="2.5" />
      <path d="M80 246L132 200M220 246L168 200" fill="none" stroke-width="1.5" opacity="0.5" />
      <circle cx="150" cy="206" r="17" fill="#8a1c24" stroke-width="2" />
      <path d="M141 212l2-10 4 5 3-8 3 8 4-5 2 10z" fill="#f2d08f" stroke="none" />
      <path d="M240 82C212 100 192 130 182 170" fill="none" stroke-width="2" />
      <path d="M240 82C220 88 200 112 188 144C206 126 226 108 240 82z" :fill="url('gold')" stroke="none" opacity="0.45" />
      <path d="M182 170l-3 8" stroke-width="2" />
      <path d="M96 276c20-6 40 4 60-2s40-8 52 0" fill="none" stroke-width="1.4" opacity="0.5" />
    </g>

    <!-- Midnight Jazz: moon, notes and a keyboard on the horizon -->
    <g v-if="art.motif === 'jazz'" stroke-linecap="round">
      <path d="M226 64a34 34 0 1 0 0 64a27 27 0 1 1 0-64z" :fill="url('moon')" />
      <path
        d="M40 214C84 178 118 238 160 206S236 176 264 204"
        fill="none"
        :stroke="url('gold')"
        stroke-width="1.6"
        opacity="0.6"
      />
      <g :fill="url('gold')" :stroke="url('gold')" stroke-width="2.5">
        <path d="M92 150V112l26-7v38" fill="none" />
        <ellipse cx="86" cy="151" rx="7.5" ry="5.5" transform="rotate(-20 86 151)" stroke="none" />
        <ellipse cx="112" cy="144" rx="7.5" ry="5.5" transform="rotate(-20 112 144)" stroke="none" />
        <path d="M188 186v-34q10 5 14 16" fill="none" />
        <ellipse cx="182" cy="187" rx="7" ry="5" transform="rotate(-20 182 187)" stroke="none" />
      </g>
      <g :stroke="url('gold')" stroke-width="1.4">
        <rect v-for="x in keys" :key="x" :x="x" y="246" width="20" height="54" fill="#f4efe6" fill-opacity="0.08" />
        <rect v-for="x in blackKeys" :key="`b${x}`" :x="x" y="246" width="12" height="32" :fill="art.sky[2]" />
      </g>
    </g>

    <!-- Late Night Stand-Up: a microphone in a spotlight -->
    <g v-if="art.motif === 'mic'" stroke-linecap="round">
      <path d="M126 0H174L262 296H38Z" :fill="url('beam')" />
      <ellipse cx="150" cy="296" rx="104" ry="10" fill="#fff3d6" opacity="0.14" />
      <g fill="none" :stroke="url('gold')">
        <rect x="134" y="122" width="32" height="54" rx="16" :fill="art.sky[2]" stroke-width="3" />
        <path d="M137 140h26M136 150h28M137 160h26" stroke-width="1.2" opacity="0.7" />
        <path d="M126 152a24 24 0 0 0 48 0" stroke-width="2.5" />
        <path d="M150 176v18M140 194h20M150 194V290" stroke-width="3" />
        <path d="M116 292q34-12 68 0" stroke-width="3" />
      </g>
    </g>

    <g v-if="!bare">
      <text
        v-for="(line, i) in lines"
        :key="i"
        x="22"
        :y="titleY[i]"
        class="t-title"
        :style="{ fontSize: `${titleSize}px` }"
      >
        {{ line }}
      </text>
      <text x="24" y="400" class="t-sub">{{ sub }}</text>
    </g>
  </svg>
</template>

<style scoped>
.poster {
  display: block;
  width: 100%;
  height: 100%;
  aspect-ratio: 300 / 420;
}
.t-title {
  font-family: var(--serif);
  font-style: italic;
  fill: #fff3d6;
}
.t-sub {
  font-family: var(--sans);
  font-size: 8.5px;
  letter-spacing: 0.22em;
  fill: #e3b25a;
  font-weight: 700;
}
</style>
