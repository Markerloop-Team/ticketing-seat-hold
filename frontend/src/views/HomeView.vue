<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import Poster from "../components/Poster.vue";
import {
  bySlug,
  categories,
  curtainUp,
  featured,
  productions,
  showDate,
  venues,
  type Category,
  type Production,
} from "../content/programme";
import { formatPrice } from "../lib/format";
import { href } from "../lib/router";

type Sort = "popular" | "price" | "date";

const slides = featured.map((slug) => bySlug[slug]);
const active = ref(0);
const paused = ref(false);
const category = ref<Category | "all">("all");
const sort = ref<Sort>("popular");

const SLIDE_MS = 7000;
let timer: ReturnType<typeof setInterval> | undefined;
function show(i: number) {
  active.value = (i + slides.length) % slides.length;
}
function restart() {
  clearInterval(timer);
  timer = setInterval(() => !paused.value && show(active.value + 1), SLIDE_MS);
}
onMounted(() => {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) restart();
});
onBeforeUnmount(() => clearInterval(timer));

function pick(i: number) {
  show(i);
  restart();
}

const when = (p: Production) => showDate(curtainUp(p));

const counts = computed(() => {
  const c = new Map<string, number>();
  for (const p of productions) c.set(p.category, (c.get(p.category) ?? 0) + 1);
  return c;
});

const listed = computed(() => {
  const list = productions.filter((p) => category.value === "all" || p.category === category.value);
  const by: Record<Sort, (a: Production, b: Production) => number> = {
    popular: (a, b) => b.popularity - a.popularity,
    price: (a, b) => a.fromPrice - b.fromPrice || a.daysOut - b.daysOut,
    date: (a, b) => a.daysOut - b.daysOut,
  };
  return [...list].sort(by[sort.value]);
});

const genreLabel = (c: Category) => categories.find((x) => x.id === c)!.label;
const sorts: Array<{ id: Sort; label: string }> = [
  { id: "popular", label: "Popular" },
  { id: "price", label: "Price" },
  { id: "date", label: "Date" },
];
</script>

<template>
  <main class="home">
    <section
      class="showcase wrap"
      aria-roledescription="carousel"
      aria-label="Featured productions"
      @mouseenter="paused = true"
      @mouseleave="paused = false"
      @focusin="paused = true"
      @focusout="paused = false"
    >
      <div class="stage-panel" :style="{ '--tint': slides[active].poster.sky[1] }">
        <TransitionGroup name="slide" tag="div" class="slides">
          <article
            v-for="(p, i) in slides"
            v-show="i === active"
            :key="p.slug"
            class="slide"
            :aria-hidden="i !== active"
            aria-roledescription="slide"
            :aria-label="`${i + 1} of ${slides.length}: ${p.title}`"
          >
            <div class="slide-copy">
              <p class="eyebrow">{{ genreLabel(p.category) }} · {{ p.company }}</p>
              <h1>{{ p.title }}</h1>
              <p class="tagline">{{ p.tagline }}</p>
              <ul class="facts">
                <li><span>Date</span><strong>{{ when(p).long }}</strong></li>
                <li><span>Curtain</span><strong>{{ when(p).time }}</strong></li>
                <li><span>Venue</span><strong>{{ venues[p.venue].short }}</strong></li>
              </ul>
              <div class="cta">
                <a class="btn" :href="href({ name: 'event', slug: p.slug })" :tabindex="i === active ? 0 : -1">
                  Choose seats
                </a>
                <p class="from">
                  From <strong>{{ formatPrice(p.fromPrice) }}</strong> ·
                  {{ Math.round(p.cashback * 100) }}% back in points
                </p>
              </div>
            </div>
            <a
              class="slide-poster"
              :href="href({ name: 'event', slug: p.slug })"
              tabindex="-1"
              aria-hidden="true"
            >
              <Poster :production="p" />
            </a>
          </article>
        </TransitionGroup>

        <div class="controls">
          <button type="button" class="arrow" aria-label="Previous production" @click="pick(active - 1)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <div class="dots" role="tablist" aria-label="Choose a featured production">
            <button
              v-for="(p, i) in slides"
              :key="p.slug"
              type="button"
              role="tab"
              class="dot"
              :class="{ on: i === active, run: i === active && !paused }"
              :aria-selected="i === active"
              :aria-label="p.title"
              :style="{ '--ms': `${SLIDE_MS}ms` }"
              @click="pick(i)"
            >
              <span />
            </button>
          </div>
          <button type="button" class="arrow" aria-label="Next production" @click="pick(active + 1)">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
          </button>
        </div>
      </div>
    </section>

    <section class="listing wrap" aria-labelledby="listing-title">
      <div class="listing-head">
        <div>
          <p class="eyebrow">Season 26/27</p>
          <h2 id="listing-title">What's on</h2>
        </div>
        <div class="sort" role="radiogroup" aria-label="Sort productions">
          <button
            v-for="s in sorts"
            :key="s.id"
            type="button"
            role="radio"
            :aria-checked="sort === s.id"
            :class="{ on: sort === s.id }"
            @click="sort = s.id"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div class="chips" role="group" aria-label="Filter by category">
        <button
          type="button"
          class="chip"
          :class="{ on: category === 'all' }"
          :aria-pressed="category === 'all'"
          @click="category = 'all'"
        >
          All <span>{{ productions.length }}</span>
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          type="button"
          class="chip"
          :class="{ on: category === c.id }"
          :aria-pressed="category === c.id"
          @click="category = c.id"
        >
          {{ c.label }} <span>{{ counts.get(c.id) ?? 0 }}</span>
        </button>
      </div>

      <TransitionGroup tag="ul" name="card" class="grid">
        <li v-for="p in listed" :key="p.slug">
          <a class="card" :href="href({ name: 'event', slug: p.slug })">
            <span class="card-art">
              <Poster :production="p" />
              <span class="date-badge">{{ when(p).short }}</span>
              <span v-if="p.popularity >= 88" class="hot">Selling fast</span>
            </span>
            <span class="card-body">
              <span class="card-genre">{{ genreLabel(p.category) }} · {{ venues[p.venue].short }}</span>
              <strong class="card-title">{{ p.title }}</strong>
              <span class="card-foot">
                <span>from <strong>{{ formatPrice(p.fromPrice) }}</strong></span>
                <span class="pts">{{ Math.round(p.cashback * 100) }}% back</span>
              </span>
            </span>
          </a>
        </li>
      </TransitionGroup>
    </section>

    <section class="platform wrap" aria-label="What the platform covers">
      <div>
        <strong>Season listing</strong>
        <p>Productions by category, sorted by popularity, price or date, across two venues.</p>
      </div>
      <div>
        <strong>Holds that never double-book</strong>
        <p>All-or-nothing seat holds with a 15-minute server-side timer.</p>
      </div>
      <div>
        <strong>Wallet and cashback</strong>
        <p>Every order lands in My tickets with signed QR codes and bonus points.</p>
      </div>
      <div>
        <strong>Gate check</strong>
        <p>The usher's scanner admits each ticket once, at the right show only.</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* showcase */
.showcase {
  padding-top: 36px;
}
.stage-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 28px;
  background:
    radial-gradient(700px 420px at 78% 40%, color-mix(in srgb, var(--tint) 70%, transparent), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  box-shadow: 0 50px 100px -60px rgba(0, 0, 0, 0.9);
  transition: background 0.8s;
}
.slides {
  display: grid;
}
.slide {
  grid-area: 1 / 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 48px;
  align-items: center;
  padding: 52px 64px 88px;
}
.slide-copy {
  min-width: 0;
}
h1 {
  margin-top: 10px;
  font-family: var(--serif);
  font-style: italic;
  font-weight: 500;
  font-size: clamp(48px, 6.4vw, 92px);
  line-height: 0.95;
  letter-spacing: -0.02em;
  background: linear-gradient(180deg, #fff8ea 30%, #e3b25a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding-bottom: 6px;
}
.tagline {
  margin-top: 12px;
  max-width: 34ch;
  font-family: var(--serif);
  font-size: 24px;
  line-height: 1.3;
  color: #e9e1d3;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  margin: 24px 0 0;
  padding: 16px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  list-style: none;
}
.facts li {
  display: grid;
  gap: 2px;
}
.facts span {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
}
.facts strong {
  font-weight: 600;
}
.cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 22px;
  margin-top: 26px;
}
.cta .btn {
  text-decoration: none;
}
.from {
  color: var(--muted);
}
.from strong {
  color: var(--text);
}
.slide-poster {
  display: block;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(227, 178, 90, 0.25);
  box-shadow:
    0 50px 90px -40px rgba(0, 0, 0, 0.95),
    0 0 0 1px rgba(0, 0, 0, 0.3);
  transform: rotate(1.6deg);
  transition: transform 0.4s var(--ease);
}
.slide-poster:hover {
  transform: rotate(0deg) translateY(-4px);
}
.slide-enter-active {
  transition: opacity 0.7s var(--ease);
}
.slide-enter-active .slide-poster,
.slide-enter-active .slide-copy {
  transition: transform 0.8s var(--ease);
}
.slide-leave-active {
  transition: opacity 0.4s;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}
.slide-enter-from .slide-poster {
  transform: rotate(5deg) translateY(24px);
}
.slide-enter-from .slide-copy {
  transform: translateY(12px);
}
.controls {
  position: absolute;
  left: 64px;
  bottom: 30px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.arrow {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.25);
}
.arrow:hover {
  border-color: var(--accent);
  color: var(--accent-2);
}
.arrow svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dots {
  display: flex;
  gap: 8px;
}
.dot {
  position: relative;
  width: 36px;
  height: 18px;
  padding: 0;
  border: 0;
  background: none;
}
.dot::before,
.dot span {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  height: 2px;
  border-radius: 2px;
}
.dot::before {
  right: 0;
  background: var(--line-strong);
}
.dot span {
  width: 0;
  background: var(--accent);
}
.dot.on span {
  width: 100%;
}
.dot.run span {
  animation: fill var(--ms) linear;
}
@keyframes fill {
  from {
    width: 0;
  }
}

/* listing */
.listing {
  margin-top: 64px;
}
.listing-head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}
.listing-head h2 {
  margin-top: 4px;
  font-family: var(--serif);
  font-weight: 600;
  font-size: 40px;
  line-height: 1.1;
}
.sort {
  display: inline-flex;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
}
.sort button {
  padding: 7px 16px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
}
.sort button.on {
  background: var(--surface-2);
  color: var(--text);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 22px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;
}
.chip span {
  color: var(--faint);
  font-size: 12px;
}
.chip:hover {
  border-color: rgba(227, 178, 90, 0.5);
}
.chip.on {
  border-color: transparent;
  background: linear-gradient(180deg, var(--accent-2), var(--accent));
  color: var(--accent-ink);
}
.chip.on span {
  color: rgba(28, 20, 7, 0.6);
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px 22px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
}
.card {
  display: grid;
  gap: 14px;
  color: inherit;
  text-decoration: none;
}
.card-art {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid rgba(227, 178, 90, 0.18);
  box-shadow: 0 30px 50px -30px rgba(0, 0, 0, 0.9);
  transition:
    transform 0.35s var(--ease),
    box-shadow 0.35s,
    border-color 0.35s;
}
.card:hover .card-art,
.card:focus-visible .card-art {
  transform: translateY(-6px);
  border-color: rgba(227, 178, 90, 0.5);
  box-shadow: 0 40px 60px -30px rgba(125, 22, 48, 0.8);
}
.date-badge,
.hot {
  position: absolute;
  top: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
}
.date-badge {
  left: 12px;
  background: rgba(12, 10, 16, 0.72);
  backdrop-filter: blur(8px);
  border: 1px solid var(--line-strong);
}
.hot {
  right: 12px;
  background: rgba(227, 178, 90, 0.92);
  color: var(--accent-ink);
}
.card-body {
  display: grid;
  gap: 4px;
}
.card-genre {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}
.card-title {
  font-family: var(--serif);
  font-size: 24px;
  font-weight: 600;
  line-height: 1.15;
}
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  color: var(--muted);
  font-size: 14px;
}
.card-foot strong {
  color: var(--text);
}
.pts {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(60, 207, 142, 0.1);
  color: #8fe6bd;
  font-size: 12px;
  font-weight: 600;
}
.card-move,
.card-enter-active,
.card-leave-active {
  transition:
    transform 0.45s var(--ease),
    opacity 0.3s;
}
.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
.card-leave-active {
  position: absolute;
  visibility: hidden;
}

/* platform */
.platform {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 72px;
}
.platform div {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
.platform strong {
  display: block;
  margin-bottom: 4px;
  color: var(--accent-2);
  font-weight: 700;
}
.platform p {
  color: var(--muted);
  font-size: 14px;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .platform {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 959px) {
  .slide {
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 28px;
    padding: 36px 36px 84px;
  }
  .controls {
    left: 36px;
  }
}
@media (max-width: 720px) {
  .slide {
    grid-template-columns: 1fr;
    padding: 24px 22px 80px;
  }
  .slide-poster {
    order: -1;
    width: 180px;
    justify-self: center;
  }
  .hot {
    display: none;
  }
  .tagline {
    font-size: 20px;
  }
  .controls {
    left: 22px;
    bottom: 24px;
  }
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 14px;
  }
  .card-title {
    font-size: 20px;
  }
  .card-foot {
    flex-wrap: wrap;
  }
  .platform {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .showcase {
    padding-top: 20px;
  }
  .stage-panel {
    border-radius: 20px;
  }
  .listing-head h2 {
    font-size: 32px;
  }
}
</style>
