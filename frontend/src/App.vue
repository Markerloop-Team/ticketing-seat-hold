<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import {
  api,
  ApiError,
  type EventInfo,
  type GateCredentials,
  type Hold,
  type Order,
  type SectionSeats,
  type SectionSummary,
} from "./api";
import GatePanel from "./components/GatePanel.vue";
import HoldCountdown from "./components/HoldCountdown.vue";
import SeatMap from "./components/SeatMap.vue";
import TicketCard from "./components/TicketCard.vue";
import VenuePlan from "./components/VenuePlan.vue";
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
const redeemed = ref(new Set<string>());

const total = computed(() => {
  if (!seatMap.value) return 0;
  const prices = new Map(seatMap.value.price_groups.map((g) => [g.id, Number(g.price)]));
  return seatMap.value.seats
    .filter((s) => selected.value.includes(s.id))
    .reduce((sum, s) => sum + (prices.get(s.price_group) ?? 0), 0);
});

async function run(task: () => Promise<void>) {
  busy.value = true;
  notice.value = "";
  try {
    await task();
  } catch (err) {
    notice.value = err instanceof Error ? err.message : "Something went wrong.";
  } finally {
    busy.value = false;
  }
}

async function loadEvent() {
  event.value = await api.getEvent(EVENT_SLUG);
}

async function openSection(next: SectionSummary) {
  section.value = next;
  selected.value = [];
  seatMap.value = await api.getSeats(EVENT_SLUG, next.id);
}

async function refreshSeats() {
  await loadEvent();
  if (section.value) seatMap.value = await api.getSeats(EVENT_SLUG, section.value.id);
}

function placeHold() {
  return run(async () => {
    try {
      hold.value = await api.createHold(EVENT_SLUG, selected.value);
      holdDeadline.value = Date.now() + hold.value.seconds_left * 1000;
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
  notice.value = "Your hold expired and the seats went back on sale.";
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
  });
}

function redeemAtGate(code: string, auth?: GateCredentials) {
  return api.redeem(code, event.value!.id, auth);
}

onMounted(() => run(loadEvent));
</script>

<template>
  <main class="page">
    <header v-if="event" class="head">
      <h1>{{ event.title }}</h1>
      <p>
        {{ event.venue }} ·
        {{ new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) }}
      </p>
    </header>

    <p v-if="notice" class="notice" role="alert">{{ notice }}</p>

    <section v-if="event && !order" class="card">
      <h2>1. Pick a section</h2>
      <VenuePlan
        :svg="event.svg"
        :sections="event.sections"
        :selected-id="section?.id ?? null"
        @select="(s) => run(() => openSection(s))"
      />
    </section>

    <section v-if="seatMap && !order" class="card">
      <h2>2. Choose seats · {{ seatMap.section.name }}</h2>
      <SeatMap
        v-model:selected="selected"
        :seats="seatMap.seats"
        :price-groups="seatMap.price_groups"
        :max-selected="event?.max_seats_per_hold"
        :disabled="!!hold || busy"
        @limit="(n) => (notice = `Up to ${n} seats per order.`)"
      />
      <div class="bar">
        <span>{{ selected.length }} selected · {{ formatPrice(total) }}</span>
        <button v-if="!hold" type="button" :disabled="!selected.length || busy" @click="placeHold">
          Hold seats
        </button>
      </div>
    </section>

    <section v-if="hold" class="card">
      <h2>3. Pay</h2>
      <HoldCountdown :deadline="holdDeadline" @expired="onExpired" />
      <form class="pay" @submit.prevent="pay">
        <input v-model="email" type="email" required placeholder="Email for tickets" />
        <button type="submit" :disabled="busy">Pay {{ formatPrice(hold.amount) }}</button>
        <button type="button" class="link" :disabled="busy" @click="cancelHold">Cancel</button>
      </form>
    </section>

    <section v-if="order" class="card">
      <h2>Your tickets</h2>
      <div class="tickets">
        <TicketCard
          v-for="t in order.tickets"
          :key="t.code"
          :ticket="t"
          :redeemed="redeemed.has(t.code)"
          @check-in="(code) => (gateCode = code)"
        />
      </div>
      <button type="button" class="link" @click="order = null">Buy more</button>
    </section>

    <section v-if="event" class="card">
      <GatePanel
        :code="gateCode"
        :needs-login="!api.isMock"
        :redeem="redeemAtGate"
        @redeemed="(code) => (redeemed = new Set([...redeemed, code]))"
      />
    </section>
  </main>
</template>

<style scoped>
.head h1 {
  margin: 0 0 4px;
}
.head p {
  margin: 0 0 20px;
  color: var(--muted);
}
.card {
  margin-bottom: 16px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
}
.card h2 {
  margin: 0 0 12px;
  font-size: 18px;
}
.notice {
  padding: 10px 14px;
  border-radius: 10px;
  background: #fff4dc;
}
.bar,
.pay {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.pay {
  justify-content: flex-start;
}
.pay input {
  flex: 1 1 220px;
}
.tickets {
  display: grid;
  gap: 12px;
  margin-bottom: 12px;
}
</style>
