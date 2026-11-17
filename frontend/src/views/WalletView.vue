<script setup lang="ts">
import { computed } from "vue";

import Poster from "../components/Poster.vue";
import TicketCard from "../components/TicketCard.vue";
import { bySlug, featured, showDate } from "../content/programme";
import { formatPrice } from "../lib/format";
import { go, href } from "../lib/router";
import { useWallet } from "../stores/wallet";

const wallet = useWallet();
const { entries, redeemed, ticketCount, points } = wallet;

const spent = computed(() => entries.value.reduce((sum, e) => sum + Number(e.order.amount), 0));
const nextShow = computed(() =>
  [...entries.value].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0],
);
const groups = computed(() =>
  [...entries.value]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((e) => ({ ...e, production: bySlug[e.slug], when: showDate(e.startsAt) })),
);
const suggestions = featured.map((slug) => bySlug[slug]);

function toGate(slug: string, code: string) {
  wallet.pendingGate.value = code;
  go({ name: "event", slug });
}
</script>

<template>
  <main class="wallet wrap">
    <header class="head">
      <p class="eyebrow">Your account</p>
      <h1>My tickets</h1>
      <p class="sub">
        Every order you pay for lands here with its QR codes, ready for the door. Bonus points come
        back on each booking.
      </p>
    </header>

    <ul class="stats" aria-label="Wallet summary">
      <li>
        <span>Tickets</span>
        <strong>{{ ticketCount }}</strong>
        <small>{{ redeemed.size }} scanned at the door</small>
      </li>
      <li class="points">
        <span>Bonus points</span>
        <strong>{{ points.toLocaleString("en-US") }}</strong>
        <small>5 to 10% back, by production</small>
      </li>
      <li>
        <span>Next show</span>
        <strong class="serif">{{ nextShow ? bySlug[nextShow.slug].title : "None yet" }}</strong>
        <small>{{ nextShow ? showDate(nextShow.startsAt).long : "Pick one from the season" }}</small>
      </li>
      <li>
        <span>Spent</span>
        <strong>{{ formatPrice(spent) }}</strong>
        <small>{{ entries.length }} order{{ entries.length === 1 ? "" : "s" }}</small>
      </li>
    </ul>

    <section v-for="g in groups" :key="g.order.token" class="order" :aria-label="g.production.title">
      <div class="order-head">
        <a class="thumb" :href="href({ name: 'event', slug: g.slug })" aria-hidden="true" tabindex="-1">
          <Poster :production="g.production" bare />
        </a>
        <div class="order-copy">
          <p class="eyebrow">{{ g.when.long }} · {{ g.when.time }}</p>
          <h2>
            <a :href="href({ name: 'event', slug: g.slug })">{{ g.production.title }}</a>
          </h2>
          <p class="meta">
            {{ g.venue }} · {{ g.order.tickets.length }} ticket{{ g.order.tickets.length > 1 ? "s" : "" }} ·
            paid {{ formatPrice(g.order.amount) }}
          </p>
        </div>
        <p class="earned">+{{ g.points.toLocaleString("en-US") }} points</p>
      </div>
      <div class="tickets">
        <TicketCard
          v-for="t in g.order.tickets"
          :key="t.code"
          :ticket="t"
          :title="g.order.event"
          :starts-at="g.startsAt"
          :venue="g.venue"
          :tier="g.tiers[t.price]"
          :redeemed="redeemed.has(t.code)"
          @check-in="(code) => toGate(g.slug, code)"
        />
      </div>
    </section>

    <section v-if="!entries.length" class="empty" aria-labelledby="empty-title">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 20h48v8a4 4 0 0 0 0 8v8H8v-8a4 4 0 0 0 0-8z" />
        <path d="M40 20v24" stroke-dasharray="3 4" />
      </svg>
      <h2 id="empty-title">No tickets yet</h2>
      <p>Book seats for any show and your e-tickets appear here, with a QR code for the door.</p>
      <ul class="picks">
        <li v-for="p in suggestions" :key="p.slug">
          <a :href="href({ name: 'event', slug: p.slug })">
            <span class="pick-art"><Poster :production="p" bare /></span>
            <span class="pick-copy">
              <strong>{{ p.title }}</strong>
              <small>{{ p.genre }}</small>
            </span>
          </a>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.wallet {
  padding-top: 48px;
}
.head h1 {
  margin-top: 8px;
  font-family: var(--serif);
  font-style: italic;
  font-weight: 500;
  font-size: clamp(48px, 6vw, 80px);
  line-height: 0.95;
  background: linear-gradient(180deg, #fff8ea 30%, #e3b25a);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  padding-bottom: 6px;
}
.sub {
  max-width: 60ch;
  margin-top: 10px;
  color: var(--muted);
  font-size: 16px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin: 32px 0 0;
  padding: 0;
  list-style: none;
}
.stats li {
  display: grid;
  gap: 4px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02));
}
.stats span {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
}
.stats strong {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stats strong.serif {
  font-family: var(--serif);
  font-weight: 600;
}
.stats small {
  color: var(--muted);
  font-size: 12.5px;
}
.stats .points {
  border-color: rgba(60, 207, 142, 0.3);
  background: linear-gradient(180deg, rgba(60, 207, 142, 0.1), rgba(60, 207, 142, 0.02));
}
.stats .points strong {
  color: #8fe6bd;
}
.order {
  margin-top: 48px;
}
.order-head {
  display: grid;
  grid-template-columns: 64px 1fr auto;
  align-items: center;
  gap: 18px;
  margin-bottom: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
.thumb {
  display: block;
  width: 64px;
  height: 84px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid rgba(227, 178, 90, 0.25);
}
.thumb :deep(svg) {
  height: 100%;
}
.order-copy h2 {
  margin-top: 2px;
  font-family: var(--serif);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.1;
}
.order-copy h2 a {
  color: inherit;
  text-decoration: none;
}
.order-copy h2 a:hover {
  color: var(--accent-2);
}
.meta {
  margin-top: 4px;
  color: var(--muted);
  font-size: 14px;
}
.earned {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(60, 207, 142, 0.1);
  color: #8fe6bd;
  font-size: 13px;
  font-weight: 700;
}
.tickets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr));
  gap: 20px;
}
.empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  margin-top: 40px;
  padding: 48px 24px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  text-align: center;
}
.empty > svg {
  width: 64px;
  height: 64px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linejoin: round;
}
.empty h2 {
  font-family: var(--serif);
  font-size: 34px;
  font-weight: 600;
}
.empty > p {
  max-width: 46ch;
  color: var(--muted);
}
.picks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 260px));
  gap: 14px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}
.picks a {
  display: grid;
  grid-template-columns: 48px 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: inherit;
  text-align: left;
  text-decoration: none;
}
.picks a:hover {
  border-color: rgba(227, 178, 90, 0.4);
}
.pick-art {
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: 10px;
}
.pick-art :deep(svg) {
  height: 100%;
  aspect-ratio: auto;
}
.pick-copy {
  display: grid;
  min-width: 0;
}
.pick-copy strong {
  font-family: var(--serif);
  font-size: 18px;
}
.pick-copy small {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 959px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .picks {
    grid-template-columns: 1fr;
    width: 100%;
    max-width: 320px;
  }
}
@media (max-width: 560px) {
  .wallet {
    padding-top: 28px;
  }
  .order-head {
    grid-template-columns: 48px 1fr;
  }
  .thumb {
    width: 48px;
    height: 64px;
  }
  .earned {
    grid-column: 2;
    justify-self: start;
  }
  .order-copy h2 {
    font-size: 26px;
  }
  .stats strong {
    font-size: 22px;
  }
}
</style>
