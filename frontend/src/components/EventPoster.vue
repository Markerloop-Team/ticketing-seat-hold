<script setup lang="ts">
// Original artwork drawn in SVG for this demo: a swan's neck over a moonlit lake.
</script>

<template>
  <svg class="poster" viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Poster: a swan on a moonlit lake">
    <defs>
      <linearGradient id="p-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2a0c1a" />
        <stop offset="0.55" stop-color="#5a1430" />
        <stop offset="1" stop-color="#0f0a14" />
      </linearGradient>
      <radialGradient id="p-moon" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#fff3d6" />
        <stop offset="0.7" stop-color="#f2d08f" />
        <stop offset="1" stop-color="#e3b25a" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="p-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#f2d08f" stop-opacity="0.45" />
        <stop offset="1" stop-color="#f2d08f" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="p-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff1cf" />
        <stop offset="1" stop-color="#c8913a" />
      </linearGradient>
      <linearGradient id="p-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1b0f1f" />
        <stop offset="1" stop-color="#07060a" />
      </linearGradient>
    </defs>
    <rect width="300" height="420" fill="url(#p-sky)" />
    <g opacity="0.55" fill="#fff">
      <circle cx="40" cy="48" r="0.9" />
      <circle cx="78" cy="96" r="0.6" />
      <circle cx="252" cy="40" r="0.8" />
      <circle cx="226" cy="118" r="0.6" />
      <circle cx="132" cy="30" r="0.5" />
      <circle cx="270" cy="170" r="0.7" />
      <circle cx="24" cy="160" r="0.6" />
    </g>
    <circle cx="186" cy="150" r="120" fill="url(#p-glow)" />
    <circle cx="186" cy="150" r="58" fill="url(#p-moon)" />
    <rect y="268" width="300" height="152" fill="url(#p-water)" />
    <g stroke="#f2d08f" stroke-linecap="round" opacity="0.5">
      <path d="M150 284h72" stroke-width="2" />
      <path d="M160 298h52" stroke-width="1.5" opacity="0.8" />
      <path d="M172 312h30" stroke-width="1.2" opacity="0.6" />
      <path d="M180 326h14" stroke-width="1" opacity="0.4" />
    </g>
    <!-- swan -->
    <path
      d="M58 268c22-4 60-6 92-4 18 1 30-6 34-18 5-16-6-30-12-46-7-20 2-44 22-48 14-3 26 6 26 18"
      fill="none"
      stroke="url(#p-gold)"
      stroke-width="5"
      stroke-linecap="round"
    />
    <path d="M220 120l14 4-12 6" fill="#e3b25a" />
    <path
      d="M58 268c18-26 52-44 88-40 22 2 30 18 34 30"
      fill="none"
      stroke="url(#p-gold)"
      stroke-width="2"
      stroke-linecap="round"
      opacity="0.8"
    />
    <path
      d="M70 262c14-14 34-22 56-22"
      fill="none"
      stroke="url(#p-gold)"
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
    <text x="22" y="378" class="t-title">Swan Lake</text>
    <text x="24" y="400" class="t-sub">MERIDIAN BALLET · SEASON 26/27</text>
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
  font-size: 40px;
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
