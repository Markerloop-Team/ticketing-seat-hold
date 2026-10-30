<script setup lang="ts">
import QRCode from "qrcode";
import { ref, watchEffect } from "vue";

import type { Ticket } from "../api";
import { formatPrice } from "../lib/format";

const props = defineProps<{ ticket: Ticket; redeemed?: boolean }>();
defineEmits<{ checkIn: [code: string] }>();

const qr = ref("");
watchEffect(async () => {
  qr.value = await QRCode.toString(props.ticket.code, { type: "svg", margin: 1 });
});
</script>

<template>
  <article class="ticket" :class="{ redeemed }">
    <!-- qrcode emits a plain <svg> built from our own ticket code -->
    <div class="qr" v-html="qr" />
    <div class="details">
      <p class="seat">{{ ticket.section }} · row {{ ticket.row }} · seat {{ ticket.number }}</p>
      <p class="price">{{ formatPrice(ticket.price) }}</p>
      <code>{{ ticket.code }}</code>
      <button type="button" :disabled="redeemed" @click="$emit('checkIn', ticket.code)">
        {{ redeemed ? "Checked in" : "Scan at gate" }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.ticket {
  display: flex;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}
.ticket.redeemed {
  opacity: 0.55;
}
.qr {
  flex: 0 0 120px;
  width: 120px;
}
.qr :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
.details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.seat,
.price {
  margin: 0;
}
.seat {
  font-weight: 600;
}
.price {
  color: var(--muted);
}
code {
  font-size: 11px;
  color: var(--muted);
  overflow-wrap: anywhere;
}
button {
  align-self: flex-start;
}
</style>
