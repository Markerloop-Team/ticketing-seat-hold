<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import {
  api,
  ApiError,
  type EventInfo,
  type GateCredentials,
  type Hold,
  type Order,
  type PriceGroup,
  type SectionSeats,
  type SectionSummary,
} from "./api";
import EventPoster from "./components/EventPoster.vue";
import GatePanel from "./components/GatePanel.vue";
import HoldCountdown from "./components/HoldCountdown.vue";
import SeatMap from "./components/SeatMap.vue";
import TicketCard from "./components/TicketCard.vue";
import VenuePlan from "./components/VenuePlan.vue";
import { programmes, season } from "./content/programme";
import { formatPrice } from "./lib/format";

const EVENT_SLUG = "swan-lake";

const event = ref<EventInfo | null>(null);
const section = ref<SectionSummary | null>(null);
const seatMap = ref<SectionSeats | null>(null);
const selected = ref<number[]>([]);
const hold = ref<Hold | null>(null);
const holdDeadline = ref(0);
const order = ref<Order | null>(null);
const email = ref("");
const notice = ref("");
const busy = ref(false);
const gateCode = ref("");
const gateNonce = ref(0);
const redeemed = ref(new Set<string>());
const knownGroups = ref(new Map<number, PriceGroup>());

const programme = computed(() => programmes[EVENT_SLUG]);
const maxSeats = computed(() => event.value?.max_seats_per_hold ?? 5);

const startsAt = computed(() => {
  if (!event.value) return null;
  const d = new Date(event.value.starts_at);
  return {
    date: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
});

const groupById = computed(
  () => new Map((seatMap.value?.price_groups ?? []).map((g) => [g.id, g] as const)),
);

const picked = computed(() => {
  if (!seatMap.value) return [];
  const order = new Map(selected.value.map((id, i) => [id, i]));
  return seatMap.value.seats
    .filter((s) => order.has(s.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .map((s) => ({ seat: s, group: groupById.value.get(s.price_group) }));
});

const total = computed(() =>
  picked.value.reduce((sum, p) => sum + Number(p.group?.price ?? 0), 0),
);

const fromPrice = computed(() => {
  const prices = [...knownGroups.value.values()].map((g) => Number(g.price));
  return prices.length ? Math.min(...prices) : null;
});

const step = computed(() => {
  if (order.value) return redeemed.value.size ? 5 : 4;
  if (hold.value) return 3;
  return selected.value.length ? 2 : 1;
});
const steps = ["Seats", "Hold", "Pay", "E-ticket", "Gate"];

// On phones the floating "Hold seats" bar steps aside while the order card itself is on screen.
const summaryVisible = ref(false);
let observer: IntersectionObserver | undefined;
function watchSummary() {
  observer?.disconnect();
  const el = document.getElementById("summary");
  if (!el || typeof IntersectionObserver === "undefined") return;
  observer = new IntersectionObserver(([entry]) => (summaryVisible.value = entry.isIntersecting), {
    rootMargin: "0px 0px -80px 0px",
  });
  observer.observe(el);
}
onBeforeUnmount(() => observer?.disconnect());

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function say(text: string) {
  notice.value = text;
  clearTimeout(noticeTimer);
  if (text) noticeTimer = setTimeout(() => (notice.value = ""), 7000);
}

async function run(task: () => Promise<void>) {
  busy.value = true;
  say("");
  try {
    await task();
  } catch (err) {
    say(err instanceof Error ? err.message : "Something went wrong.");
  } finally {
    busy.value = false;
  }
}

function remember(groups: PriceGroup[]) {
  const next = new Map(knownGroups.value);
  for (const g of groups) next.set(g.id, g);
  knownGroups.value = next;
}

async function loadEvent() {
  event.value = await api.getEvent(EVENT_SLUG);
}

async function openSection(next: SectionSummary) {
  section.value = next;
  selected.value = [];
  seatMap.value = await api.getSeats(EVENT_SLUG, next.id);
  remember(seatMap.value.price_groups);
}

async function refreshSeats() {
  await loadEvent();
  if (section.value) {
    seatMap.value = await api.getSeats(EVENT_SLUG, section.value.id);
    remember(seatMap.value.price_groups);
  }
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function placeHold() {
  return run(async () => {
    try {
      hold.value = await api.createHold(EVENT_SLUG, selected.value);
      holdDeadline.value = Date.now() + hold.value.seconds_left * 1000;
      if (window.matchMedia("(max-width: 959px)").matches) {
        await nextTick();
        scrollTo("summary");
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "seats_unavailable") {
        const gone = new Set((err.payload.seat_ids as number[]) ?? []);
        selected.value = selected.value.filter((id) => !gone.has(id));
        await refreshSeats();
        throw new Error("Someone was faster with some of those seats. Please pick again.");
      }
      throw err;
    }
  });
}

function cancelHold() {
  return run(async () => {
    if (hold.value) await api.releaseHold(hold.value.token);
    hold.value = null;
    await refreshSeats();
  });
}

async function onExpired() {
  hold.value = null;
  selected.value = [];
  await refreshSeats();
  say("Your hold expired and the seats went back on sale.");
}

function pay() {
  return run(async () => {
    if (!hold.value) return;
    // Stands in for the payment provider redirect + callback.
    const reference = `demo-${crypto.randomUUID()}`;
    order.value = await api.confirmPayment(hold.value.token, {
      payment_reference: reference,
      email: email.value,
    });
    hold.value = null;
    selected.value = [];
    await refreshSeats();
    await nextTick();
    scrollTo("tickets");
  });
}

function unpick(id: number) {
  selected.value = selected.value.filter((s) => s !== id);
}

function tierFor(price: string) {
  return [...knownGroups.value.values()].find((g) => Number(g.price) === Number(price))?.name;
}

async function sendToGate(code: string) {
  gateCode.value = code;
  gateNonce.value++;
  await nextTick();
  scrollTo("gate");
}

function bookMore() {
  order.value = null;
  nextTick(() => scrollTo("seats"));
}

function redeemAtGate(code: string, auth?: GateCredentials) {
  return api.redeem(code, event.value!.id, auth);
}

watch(
  () => !!event.value && !order.value,
  (shown) => shown && nextTick(watchSummary),
);

onMounted(() =>
  run(async () => {
    await loadEvent();
    // Open the first section with seats left so the map is the first thing a visitor sees.
    const sections = event.value?.sections ?? [];
    const first = sections.find((s) => s.available > 0);
    if (first) await openSection(first);
    // Learn every section's price tiers so the hero can say "from".
    const others = await Promise.all(
      sections.filter((s) => s !== first).map((s) => api.getSeats(EVENT_SLUG, s.id)),
    );
    for (const o of others) remember(o.price_groups);
  }),
);
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="wrap topbar-inner">
        <a class="brand" href="#top" aria-label="Grand Hall box office, top of page">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M9 22c3-1 5-4 5-8 0-3 2-5 4-5s3 2 2 4c-1 3-5 4-5 9h8"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span>Grand Hall</span>
          <small>Box office</small>
        </a>
        <p class="demo-pill">
          <span class="pulse" aria-hidden="true" />
          Live demo · runs in your browser
        </p>
      </div>
    </header>

    <div v-if="notice" class="toast" role="alert">
      <span>{{ notice }}</span>
      <button type="button" aria-label="Dismiss" @click="say('')">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>

    <main id="top">
      <section v-if="event" class="hero wrap" aria-labelledby="event-title">
        <div class="poster-frame">
          <EventPoster />
        </div>
        <div class="hero-copy">
          <p class="eyebrow">{{ programme.company }} · {{ programme.genre }}</p>
          <h1 id="event-title">{{ event.title }}</h1>
          <p class="tagline">{{ programme.tagline }}</p>
          <ul class="facts">
            <li v-if="startsAt">
              <span>Date</span><strong>{{ startsAt.date }}</strong>
            </li>
            <li v-if="startsAt">
              <span>Curtain</span><strong>{{ startsAt.time }}</strong>
            </li>
            <li>
              <span>Venue</span><strong>{{ event.venue }}</strong>
            </li>
            <li>
              <span>Running time</span><strong>{{ programme.duration }}</strong>
            </li>
          </ul>
          <p class="description">{{ programme.description }}</p>
          <div class="hero-cta">
            <button type="button" class="btn" @click="scrollTo('seats')">Choose seats</button>
            <p v-if="fromPrice !== null" class="from">
              Tickets from <strong>{{ formatPrice(fromPrice) }}</strong> · Age {{ programme.age }}
            </p>
          </div>
          <dl class="credits">
            <div v-for="c in programme.credits" :key="c.role">
              <dt>{{ c.role }}</dt>
              <dd>{{ c.name }}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section class="proof wrap" aria-label="What this demo shows">
        <div>
          <strong>All-or-nothing holds</strong>
          <p>Two buyers can never get the same seat. A hold takes every seat you asked for, or none.</p>
        </div>
        <div>
          <strong>15 minutes, server time</strong>
          <p>The countdown follows the server's clock, then the seats go straight back on sale.</p>
        </div>
        <div>
          <strong>Signed QR, scanned once</strong>
          <p>Forged codes are rejected, and a ticket that is already in cannot get in again.</p>
        </div>
      </section>

      <ol class="steps wrap" aria-label="Booking progress">
        <li
          v-for="(label, i) in steps"
          :key="label"
          :class="{ done: i + 1 < step, current: i + 1 === step }"
          :aria-current="i + 1 === step ? 'step' : undefined"
        >
          <span class="num">{{ i + 1 }}</span>
          <span class="lbl">{{ label }}</span>
        </li>
      </ol>

      <section v-if="event && !order" id="seats" class="booking wrap" aria-labelledby="seats-title">
        <div class="panel hall">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Step 1 · Choose your seats</p>
              <h2 id="seats-title">{{ seatMap?.section.name ?? "Pick a section" }}</h2>
            </div>
            <p class="hint">
              Select up to {{ maxSeats }} seats. Hover or focus a seat to see its row and price.
            </p>
          </div>
          <div class="hall-grid">
            <div class="overview">
              <p class="mini-title">Sections</p>
              <VenuePlan
                :svg="event.svg"
                :sections="event.sections"
                :selected-id="section?.id ?? null"
                @select="(s) => run(() => openSection(s))"
              />
            </div>
            <div class="map">
              <SeatMap
                v-if="seatMap"
                v-model:selected="selected"
                :seats="seatMap.seats"
                :price-groups="seatMap.price_groups"
                :max-selected="maxSeats"
                :disabled="!!hold || busy"
                @limit="(n) => say(`Up to ${n} seats per order.`)"
              />
            </div>
          </div>
        </div>

        <aside id="summary" class="panel summary" aria-labelledby="summary-title">
          <p class="eyebrow">{{ hold ? "Step 3 · Pay" : "Step 2 · Hold" }}</p>
          <h2 id="summary-title">Your order</h2>

          <HoldCountdown v-if="hold" class="timer" :deadline="holdDeadline" @expired="onExpired">
            <p class="timer-copy">
              <strong>Your seats are held.</strong>
              Nobody else can take them until the timer runs out. Then they go back on sale.
            </p>
          </HoldCountdown>

          <ul v-if="picked.length" class="lines">
            <li v-for="p in picked" :key="p.seat.id">
              <span class="swatch" :style="{ background: p.group?.color }" />
              <span class="where">
                <strong>Row {{ p.seat.row }}, seat {{ p.seat.number }}</strong>
                <small>{{ seatMap?.section.name }} · {{ p.group?.name }}</small>
              </span>
              <span class="amt">{{ formatPrice(p.group?.price ?? 0) }}</span>
              <button
                v-if="!hold"
                type="button"
                class="remove"
                :aria-label="`Remove row ${p.seat.row}, seat ${p.seat.number}`"
                @click="unpick(p.seat.id)"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </li>
          </ul>
          <div v-else class="empty">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path d="M12 30v-8a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v8M9 30h30v6H9zM13 36v4M35 36v4" />
            </svg>
            <p>No seats yet. Pick up to {{ maxSeats }} on the map.</p>
          </div>

          <div class="total">
            <span>Total</span>
            <strong>{{ formatPrice(hold ? hold.amount : total) }}</strong>
          </div>

          <template v-if="!hold">
            <button
              type="button"
              class="btn block"
              :disabled="!selected.length || busy"
              @click="placeHold"
            >
              {{ selected.length ? `Hold ${selected.length} seat${selected.length > 1 ? "s" : ""} for 15:00` : "Hold seats" }}
            </button>
            <p class="fine">
              Holding is free. If anyone grabs one of these seats first, nothing is held and the map
              refreshes.
            </p>
          </template>

          <form v-else class="pay" @submit.prevent="pay">
            <label>
              <span>Email for your tickets</span>
              <input
                v-model="email"
                type="email"
                required
                autocomplete="email"
                placeholder="you@example.com"
              />
            </label>
            <button type="submit" class="btn block" :disabled="busy">
              Pay {{ formatPrice(hold.amount) }}
            </button>
            <div class="pay-foot">
              <span class="fine">Demo payment. No card needed.</span>
              <button type="button" class="link" :disabled="busy" @click="cancelHold">
                Release seats
              </button>
            </div>
          </form>
        </aside>
      </section>

      <section v-if="order" id="tickets" class="tickets-section wrap" aria-labelledby="tickets-title">
        <div class="tickets-head">
          <p class="eyebrow">Step 4 · Your e-tickets</p>
          <h2 id="tickets-title">You're going to {{ order.event }}</h2>
          <p class="sub">
            Paid {{ formatPrice(order.amount) }}<template v-if="order.email">
              · tickets sent to {{ order.email }}</template
            >. Each QR code is signed, so it only opens the door once.
          </p>
        </div>
        <div class="tickets">
          <TicketCard
            v-for="t in order.tickets"
            :key="t.code"
            :ticket="t"
            :title="order.event"
            :starts-at="event?.starts_at"
            :venue="event?.venue"
            :tier="tierFor(t.price)"
            :redeemed="redeemed.has(t.code)"
            @check-in="sendToGate"
          />
        </div>
        <button type="button" class="btn ghost" @click="bookMore">Book more seats</button>
      </section>

      <section v-if="event" id="gate" class="gate-section wrap" aria-labelledby="gate-title">
        <div class="gate-copy">
          <p class="eyebrow">Step 5 · At the door</p>
          <h2 id="gate-title">The usher's scanner</h2>
          <p>
            Every ticket carries a signed code. The gate checks the signature before it touches the
            database, then admits the ticket exactly once, even if two gates scan it at the same
            moment.
          </p>
          <ol class="try">
            <li :class="{ done: !!order }">Buy a ticket above.</li>
            <li :class="{ done: !!gateCode }"><span>Press <em>Scan at gate</em> on it.</span></li>
            <li :class="{ done: redeemed.size > 0 }">Validate it: the screen turns green.</li>
            <li>Scan the same ticket again to see the gate turn it away.</li>
          </ol>
        </div>
        <GatePanel
          :code="gateCode"
          :nonce="gateNonce"
          :needs-login="!api.isMock"
          :redeem="redeemAtGate"
          @redeemed="(code) => (redeemed = new Set([...redeemed, code]))"
        />
      </section>

      <section class="season wrap" aria-labelledby="season-title">
        <h2 id="season-title" class="mini-title">Also this season</h2>
        <ul>
          <li v-for="s in season" :key="s.title" :style="{ '--hue': s.hue }">
            <span class="art" aria-hidden="true" />
            <span class="s-copy">
              <strong>{{ s.title }}</strong>
              <small>{{ s.genre }}</small>
            </span>
            <span class="s-date">{{ s.date }}</span>
          </li>
        </ul>
      </section>
    </main>

    <footer class="foot wrap">
      <p>
        A working slice of a theatre ticketing platform: seat map, 15-minute hold, payment, QR ticket
        and gate check. The API runs in your browser with the backend's rules; no real payments are
        taken. Production, cast and venue are fictional.
      </p>
    </footer>

    <Transition name="bar">
      <div v-if="selected.length && !hold && !order && !summaryVisible" class="mobile-bar">
        <span>
          <strong>{{ selected.length }} seat{{ selected.length > 1 ? "s" : "" }}</strong>
          {{ formatPrice(total) }}
        </span>
        <button type="button" class="btn" :disabled="busy" @click="placeHold">Hold seats</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 24px;
}

/* top bar */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--line);
  background: rgba(12, 10, 16, 0.72);
  backdrop-filter: blur(14px) saturate(140%);
}
.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  height: 60px;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: var(--text);
  text-decoration: none;
}
.brand svg {
  align-self: center;
  width: 26px;
  height: 26px;
  color: var(--accent);
}
.brand span {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 600;
}
.brand small {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.demo-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 12px;
  color: var(--muted);
}
.pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 0 0 rgba(60, 207, 142, 0.6);
  animation: ping 2s infinite;
}
@keyframes ping {
  70% {
    box-shadow: 0 0 0 8px rgba(60, 207, 142, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(60, 207, 142, 0);
  }
}

/* toast */
.toast {
  position: fixed;
  top: 76px;
  left: 50%;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: calc(100vw - 32px);
  padding: 12px 12px 12px 18px;
  border: 1px solid rgba(227, 178, 90, 0.4);
  border-radius: 14px;
  background: #241c14;
  box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.9);
  font-weight: 600;
  transform: translateX(-50%);
  animation: drop 0.3s var(--ease);
}
.toast button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border: 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
}
.toast svg,
.remove svg {
  width: 12px;
  height: 12px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
}
@keyframes drop {
  from {
    opacity: 0;
    transform: translate(-50%, -10px);
  }
}

/* hero */
.hero {
  display: grid;
  grid-template-columns: minmax(240px, 340px) 1fr;
  gap: 56px;
  align-items: start;
  padding-top: 56px;
  padding-bottom: 40px;
}
.poster-frame {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(227, 178, 90, 0.25);
  box-shadow:
    0 50px 90px -40px rgba(125, 22, 48, 0.9),
    0 30px 60px -30px rgba(0, 0, 0, 0.9);
  transform: rotate(-1.2deg);
  animation: poster-in 0.9s var(--ease) both;
}
@keyframes poster-in {
  from {
    opacity: 0;
    transform: rotate(-4deg) translateY(20px);
  }
}
.hero-copy {
  min-width: 0;
  animation: fade-up 0.8s 0.1s var(--ease) both;
}
@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
h1 {
  margin-top: 10px;
  font-family: var(--serif);
  font-style: italic;
  font-weight: 500;
  font-size: clamp(56px, 8vw, 104px);
  line-height: 0.92;
  letter-spacing: -0.02em;
  background: linear-gradient(180deg, #fff8ea 30%, #e3b25a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding-bottom: 6px;
}
.tagline {
  margin-top: 12px;
  font-family: var(--serif);
  font-size: 24px;
  line-height: 1.3;
  color: #e9e1d3;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  margin: 28px 0 0;
  padding: 18px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  list-style: none;
}
.facts li {
  display: grid;
  gap: 2px;
}
.facts span,
.credits dt,
.mini-title {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
}
.facts strong {
  font-weight: 600;
}
.description {
  max-width: 62ch;
  margin-top: 22px;
  color: #cfc7bb;
  font-size: 16px;
  line-height: 1.7;
}
.hero-cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 22px;
  margin-top: 28px;
}
.from {
  color: var(--muted);
}
.from strong {
  color: var(--text);
}
.credits {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px 24px;
  margin: 34px 0 0;
}
.credits dd {
  margin: 3px 0 0;
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 600;
}

/* proof */
.proof {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.proof div {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
.proof strong {
  display: block;
  margin-bottom: 4px;
  color: var(--accent-2);
  font-weight: 700;
}
.proof p {
  color: var(--muted);
  font-size: 14px;
}

/* steps */
.steps {
  display: flex;
  gap: 8px;
  margin-top: 48px;
  margin-bottom: 20px;
  list-style: none;
}
.steps li {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  border-top: 2px solid var(--line);
  color: var(--faint);
  font-size: 13px;
  font-weight: 600;
  transition:
    color 0.3s,
    border-color 0.3s;
}
.steps .num {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--line-strong);
  font-size: 11px;
  transition: all 0.3s;
}
.steps li.done {
  color: var(--muted);
  border-color: rgba(227, 178, 90, 0.5);
}
.steps li.done .num {
  background: rgba(227, 178, 90, 0.15);
  border-color: transparent;
  color: var(--accent);
}
.steps li.current {
  color: var(--text);
  border-color: var(--accent);
}
.steps li.current .num {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
  box-shadow: 0 0 16px rgba(227, 178, 90, 0.6);
}

/* panels */
.panel {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02));
  box-shadow: 0 30px 60px -40px rgba(0, 0, 0, 0.9);
}
.panel h2,
.tickets-head h2,
.gate-copy h2 {
  margin-top: 4px;
  font-family: var(--serif);
  font-weight: 600;
  font-size: 34px;
  line-height: 1.1;
}
.booking {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  align-items: start;
  scroll-margin-top: 80px;
}
.hall {
  padding: 28px;
  min-width: 0;
}
.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: space-between;
  gap: 8px 24px;
  margin-bottom: 22px;
}
.hint {
  max-width: 300px;
  color: var(--muted);
  font-size: 13px;
}
.hall-grid {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
.overview {
  padding: 16px 12px 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.2);
}
.overview .mini-title {
  margin: 0 0 8px 4px;
}
.map {
  min-width: 0;
}

.summary {
  position: sticky;
  top: 84px;
  display: grid;
  gap: 18px;
  padding: 26px;
  scroll-margin-top: 80px;
}
.summary h2 {
  margin-top: -12px;
}
.timer {
  padding: 16px;
  border-radius: 16px;
  background: rgba(227, 178, 90, 0.07);
  border: 1px solid rgba(227, 178, 90, 0.2);
  animation: fade-up 0.4s var(--ease);
}
.timer-copy {
  font-size: 13px;
  line-height: 1.5;
}
.timer-copy strong {
  display: block;
  color: var(--text);
  font-size: 14px;
}
.lines {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lines li {
  display: grid;
  grid-template-columns: 10px 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
  animation: fade-up 0.3s var(--ease);
}
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.where {
  display: grid;
  min-width: 0;
}
.where small {
  color: var(--muted);
  font-size: 12px;
}
.amt {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.remove {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
}
.remove:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}
.empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 22px 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 14px;
  color: var(--muted);
  text-align: center;
  font-size: 14px;
}
.empty svg {
  width: 40px;
  height: 40px;
  fill: none;
  stroke: var(--faint);
  stroke-width: 2;
  stroke-linejoin: round;
}
.total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.total span {
  color: var(--muted);
}
.total strong {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}
.fine {
  color: var(--faint);
  font-size: 12px;
  line-height: 1.5;
}
.pay {
  display: grid;
  gap: 14px;
}
.pay label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}
.pay-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

/* tickets */
.tickets-section {
  scroll-margin-top: 80px;
}
.tickets-head {
  margin-bottom: 24px;
}
.sub {
  margin-top: 8px;
  color: var(--muted);
  max-width: 70ch;
}
.tickets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

/* gate */
.gate-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 48px;
  align-items: center;
  margin-top: 72px;
  padding-top: 56px;
  border-top: 1px solid var(--line);
  scroll-margin-top: 70px;
}
.gate-copy > p:not(.eyebrow) {
  max-width: 54ch;
  margin-top: 14px;
  color: #cfc7bb;
  font-size: 16px;
  line-height: 1.7;
}
.try {
  display: grid;
  gap: 10px;
  margin: 26px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: try;
}
.try li {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  counter-increment: try;
}
.try li::before {
  content: counter(try);
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
}
.try li.done {
  color: var(--text);
}
.try li.done::before {
  content: "✓";
  border-color: var(--ok);
  background: rgba(60, 207, 142, 0.15);
  color: var(--ok);
}
.try em {
  font-style: normal;
  color: var(--accent-2);
}

/* season */
.season {
  margin-top: 80px;
}
.season ul {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.season li {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
.art {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background:
    radial-gradient(circle at 70% 30%, hsl(calc(var(--hue) * 1deg) 70% 70% / 0.9), transparent 45%),
    linear-gradient(160deg, hsl(calc(var(--hue) * 1deg) 55% 28%), #0c0a10);
}
.s-copy {
  display: grid;
  min-width: 0;
}
.s-copy strong {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 600;
}
.s-copy small,
.s-date {
  color: var(--muted);
  font-size: 12px;
}
.foot {
  margin-top: 48px;
  padding-top: 24px;
  padding-bottom: 48px;
  border-top: 1px solid var(--line);
}
.foot p {
  max-width: 80ch;
  color: var(--faint);
  font-size: 13px;
}

.mobile-bar {
  display: none;
}

@media (max-width: 1100px) {
  .hall-grid {
    grid-template-columns: 1fr;
  }
  .overview {
    max-width: 360px;
  }
}

@media (max-width: 959px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 32px;
    padding-top: 32px;
  }
  .poster-frame {
    max-width: 260px;
  }
  .booking,
  .gate-section {
    grid-template-columns: 1fr;
  }
  .summary {
    position: static;
  }
  .proof,
  .season ul {
    grid-template-columns: 1fr;
  }
  .credits {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .app {
    padding-bottom: 80px;
  }
  .overview {
    max-width: 300px;
    margin-inline: auto;
    width: 100%;
  }
  .mobile-bar {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 18px;
    border: 1px solid rgba(227, 178, 90, 0.35);
    border-radius: 999px;
    background: rgba(23, 20, 29, 0.92);
    backdrop-filter: blur(12px);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.8);
  }
  .mobile-bar span {
    display: grid;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.3;
  }
  .mobile-bar strong {
    color: var(--text);
  }
  .bar-enter-active,
  .bar-leave-active {
    transition:
      transform 0.3s var(--ease),
      opacity 0.3s;
  }
  .bar-enter-from,
  .bar-leave-to {
    transform: translateY(120%);
    opacity: 0;
  }
}

@media (max-width: 560px) {
  .wrap {
    padding-inline: 16px;
  }
  .demo-pill {
    font-size: 0;
    gap: 0;
    padding: 8px;
  }
  .brand small {
    display: none;
  }
  .hero {
    padding-top: 20px;
    gap: 24px;
  }
  .poster-frame {
    max-width: none;
    height: 230px;
    transform: none;
  }
  .poster-frame :deep(svg) {
    aspect-ratio: auto;
  }
  .tagline {
    font-size: 20px;
  }
  .facts {
    gap: 12px 20px;
  }
  .hall {
    padding: 18px 14px;
  }
  .panel h2,
  .tickets-head h2,
  .gate-copy h2 {
    font-size: 28px;
  }
  .steps .lbl {
    display: none;
  }
  .steps li.current .lbl {
    display: inline;
  }
  .summary {
    padding: 20px;
  }
  .gate-section {
    margin-top: 48px;
    padding-top: 40px;
  }
}
</style>
