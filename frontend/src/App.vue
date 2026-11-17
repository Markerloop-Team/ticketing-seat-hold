<script setup lang="ts">
import { computed, watchEffect } from "vue";

import { bySlug } from "./content/programme";
import { href, route } from "./lib/router";
import { useWallet } from "./stores/wallet";
import EventView from "./views/EventView.vue";
import HomeView from "./views/HomeView.vue";
import WalletView from "./views/WalletView.vue";

const wallet = useWallet();

const production = computed(() =>
  route.value.name === "event" ? bySlug[route.value.slug] : undefined,
);

watchEffect(() => {
  const base = "Meridian box office";
  document.title =
    route.value.name === "tickets"
      ? `My tickets · ${base}`
      : production.value
        ? `${production.value.title} · ${base}`
        : `Season 26/27 · ${base}`;
});
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="wrap topbar-inner">
        <a class="brand" :href="href({ name: 'home' })" aria-label="Meridian box office, season home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M9 22c3-1 5-4 5-8 0-3 2-5 4-5s3 2 2 4c-1 3-5 4-5 9h8"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span>Meridian</span>
          <small>Box office</small>
        </a>
        <nav class="nav" aria-label="Main">
          <a :href="href({ name: 'home' })" :class="{ on: route.name !== 'tickets' }">What's on</a>
          <a :href="href({ name: 'tickets' })" :class="{ on: route.name === 'tickets' }">
            My tickets
            <span v-if="wallet.ticketCount.value" class="badge">{{ wallet.ticketCount.value }}</span>
          </a>
        </nav>
        <p class="demo-pill">
          <span class="pulse" aria-hidden="true" />
          Live demo · runs in your browser
        </p>
      </div>
    </header>

    <EventView v-if="route.name === 'event' && production" :key="production.slug" :slug="production.slug" />
    <WalletView v-else-if="route.name === 'tickets'" />
    <HomeView v-else />

    <footer class="foot wrap">
      <p>
        A working slice of a theatre ticketing platform: season listing, seat map, 15-minute hold,
        payment, QR ticket, ticket wallet with cashback and gate check. The API runs in your browser
        with the backend's rules; no real payments are taken. Productions, cast and venues are
        fictional.
      </p>
    </footer>
  </div>
</template>

<style scoped>
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
.nav {
  display: flex;
  gap: 4px;
  margin-left: 28px;
}
.nav a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition:
    color 0.2s,
    background 0.2s;
}
.nav a:hover {
  color: var(--text);
}
.nav a.on {
  color: var(--text);
  background: var(--surface-2);
}
.badge {
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 11px;
  font-weight: 800;
}
.demo-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
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

@media (max-width: 720px) {
  .demo-pill {
    font-size: 0;
    gap: 0;
    padding: 8px;
  }
  .nav {
    margin-left: 8px;
  }
  .nav a {
    padding: 8px 10px;
    font-size: 13px;
  }
}
@media (max-width: 560px) {
  .brand small {
    display: none;
  }
  .brand span {
    font-size: 19px;
  }
}
</style>
