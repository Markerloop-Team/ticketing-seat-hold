<script setup lang="ts">
import QRCode from "qrcode";
import { computed, ref, watchEffect } from "vue";

import type { Ticket } from "../api";
import { formatPrice } from "../lib/format";

const props = defineProps<{
  ticket: Ticket;
  redeemed?: boolean;
  title?: string;
  startsAt?: string;
  venue?: string;
  tier?: string;
}>();
defineEmits<{ checkIn: [code: string] }>();

const qr = ref("");
watchEffect(async () => {
  qr.value = await QRCode.toString(props.ticket.code, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#16121c", light: "#00000000" },
  });
});

const when = computed(() => {
  if (!props.startsAt) return null;
  const d = new Date(props.startsAt);
  return {
    day: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
});
const shortCode = computed(() => props.ticket.code.split(":")[0].slice(0, 8).toUpperCase());
</script>

<template>
  <article class="ticket" :class="{ redeemed }" :aria-label="`Ticket: ${ticket.section}, row ${ticket.row}, seat ${ticket.number}`">
    <div class="main">
      <p class="eyebrow">Admit one · E-ticket</p>
      <h3 class="title">{{ title ?? "Your ticket" }}</h3>
      <p v-if="when || venue" class="meta">
        <template v-if="when">{{ when.day }} · {{ when.time }}</template>
        <template v-if="venue"><br />{{ venue }}</template>
      </p>
      <dl class="place">
        <div>
          <dt>Section</dt>
          <dd>{{ ticket.section }}</dd>
        </div>
        <div>
          <dt>Row</dt>
          <dd class="num">{{ ticket.row }}</dd>
        </div>
        <div>
          <dt>Seat</dt>
          <dd class="num">{{ ticket.number }}</dd>
        </div>
      </dl>
      <p class="price">
        <span v-if="tier">{{ tier }} · </span>{{ formatPrice(ticket.price) }}
      </p>
    </div>
    <div class="stub">
      <!-- qrcode emits a plain <svg> built from our own ticket code -->
      <div class="qr" v-html="qr" />
      <p class="code" :title="ticket.code">No. {{ shortCode }}</p>
      <button
        type="button"
        class="btn ghost scan"
        @click="$emit('checkIn', ticket.code)"
      >
        {{ redeemed ? "Try it again" : "Scan at gate" }}
      </button>
    </div>
    <p v-if="redeemed" class="stamp" aria-hidden="true">Admitted</p>
  </article>
</template>

<style scoped>
.ticket {
  --notch: 14px;
  position: relative;
  display: grid;
  grid-template-columns: 1fr 200px;
  border-radius: 22px;
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(125, 22, 48, 0.55), transparent 60%),
    linear-gradient(160deg, #221a27, #141118);
  border: 1px solid rgba(227, 178, 90, 0.28);
  box-shadow:
    0 30px 60px -30px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  -webkit-mask:
    radial-gradient(circle var(--notch) at calc(100% - 200px) 0, transparent 98%, #000) top / 100% 51% no-repeat,
    radial-gradient(circle var(--notch) at calc(100% - 200px) 100%, transparent 98%, #000) bottom / 100% 51% no-repeat;
  mask:
    radial-gradient(circle var(--notch) at calc(100% - 200px) 0, transparent 98%, #000) top / 100% 51% no-repeat,
    radial-gradient(circle var(--notch) at calc(100% - 200px) 100%, transparent 98%, #000) bottom / 100% 51% no-repeat;
  animation: rise 0.6s var(--ease) both;
  overflow: hidden;
}
.main {
  padding: 24px 26px;
  min-width: 0;
}
.title {
  margin-top: 6px;
  font-family: var(--serif);
  font-style: italic;
  font-weight: 500;
  font-size: 36px;
  line-height: 1;
}
.meta {
  margin-top: 8px;
  color: var(--muted);
  font-size: 13px;
}
.place {
  display: flex;
  gap: 26px;
  margin: 20px 0 0;
}
.place div {
  min-width: 0;
}
dt {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--faint);
}
dd {
  margin: 2px 0 0;
  font-family: var(--serif);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--accent-2);
}
dd.num {
  font-family: var(--sans);
  font-size: 26px;
  font-weight: 700;
  line-height: 1.27;
  font-variant-numeric: tabular-nums;
}
.price {
  margin-top: 14px;
  font-size: 13px;
  color: var(--muted);
}
.stub {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 22px 20px;
  border-left: 2px dashed rgba(255, 255, 255, 0.14);
}
.qr {
  width: 132px;
  padding: 10px;
  border-radius: 14px;
  background: #fbf6ec;
}
.qr :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
.code {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--muted);
}
.scan {
  min-height: 38px;
  padding: 0 16px;
  font-size: 13px;
}
.ticket.redeemed .qr {
  opacity: 0.35;
}
.stamp {
  position: absolute;
  top: 82%;
  left: calc(100% - 200px - 96px);
  padding: 6px 16px;
  background: rgba(12, 10, 16, 0.7);
  border: 3px solid var(--ok);
  border-radius: 10px;
  color: var(--ok);
  font-weight: 800;
  font-size: 22px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  transform: translate(-50%, -50%) rotate(-12deg);
  animation: stamp 0.35s var(--ease) both;
  pointer-events: none;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
}
@keyframes stamp {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-12deg) scale(1.8);
  }
}

@media (max-width: 560px) {
  .stamp {
    top: 34%;
    left: 70%;
  }
  .ticket {
    grid-template-columns: 1fr;
    -webkit-mask:
      radial-gradient(circle var(--notch) at 0 var(--cut, 62%), transparent 98%, #000) left / 51% 100% no-repeat,
      radial-gradient(circle var(--notch) at 100% var(--cut, 62%), transparent 98%, #000) right / 51% 100% no-repeat;
    mask:
      radial-gradient(circle var(--notch) at 0 var(--cut, 62%), transparent 98%, #000) left / 51% 100% no-repeat,
      radial-gradient(circle var(--notch) at 100% var(--cut, 62%), transparent 98%, #000) right / 51% 100% no-repeat;
  }
  .main {
    padding: 22px 20px 18px;
  }
  .stub {
    display: grid;
    grid-template-columns: 120px 1fr;
    align-items: center;
    column-gap: 18px;
    border-left: 0;
    border-top: 2px dashed rgba(255, 255, 255, 0.14);
    padding: 18px 20px 20px;
  }
  .qr {
    width: 120px;
  }
  .qr {
    grid-row: span 2;
  }
  .stub .code {
    align-self: end;
  }
  .stub .scan {
    align-self: start;
    justify-self: start;
  }
  .place {
    gap: 20px;
  }
}
</style>
