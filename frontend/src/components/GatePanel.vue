<script setup lang="ts">
import { nextTick, reactive, ref, watch } from "vue";

import { ApiError, type GateCredentials, type Redeemed } from "../api";

const props = defineProps<{
  code: string;
  needsLogin: boolean;
  redeem: (code: string, auth?: GateCredentials) => Promise<Redeemed>;
  /** Bumped by the parent each time a ticket is sent to the gate, even the same one again. */
  nonce?: number;
}>();
const emit = defineEmits<{ redeemed: [code: string] }>();

const input = ref(props.code);
const auth = reactive<GateCredentials>({ username: "gate", password: "" });
const result = ref<{ ok: boolean; title: string; text: string } | null>(null);
const busy = ref(false);
const admitted = ref(0);
const field = ref<HTMLInputElement | null>(null);
const again = ref<HTMLButtonElement | null>(null);

watch(
  () => [props.code, props.nonce],
  () => {
    input.value = props.code;
    result.value = null;
  },
);

const messages: Record<string, string> = {
  already_redeemed: "Already used",
  invalid_ticket_code: "Not a valid ticket",
  ticket_not_found: "Unknown ticket",
  wrong_event: "Ticket is for another event",
};

async function submit() {
  busy.value = true;
  try {
    const t = await props.redeem(input.value.trim(), props.needsLogin ? auth : undefined);
    admitted.value++;
    result.value = {
      ok: true,
      title: "Welcome",
      text: `${t.section} · Row ${t.row} · Seat ${t.number}`,
    };
    emit("redeemed", input.value.trim());
  } catch (err) {
    const code = err instanceof ApiError ? err.code : "error";
    const when =
      err instanceof ApiError && typeof err.payload.redeemed_at === "string"
        ? `First scanned at ${new Date(err.payload.redeemed_at).toLocaleTimeString("en-GB")}`
        : "Do not admit. Send the guest to the box office.";
    result.value = { ok: false, title: messages[code] ?? "Check failed", text: when };
  } finally {
    busy.value = false;
    await nextTick();
    again.value?.focus();
  }
}

async function reset() {
  result.value = null;
  await nextTick();
  field.value?.focus();
}
</script>

<template>
  <div class="device">
    <div class="screen">
      <header class="status">
        <span class="dot" :class="{ live: !busy }" />
        <span>Gate 2 · Main entrance</span>
        <span class="count">{{ admitted }} in</span>
      </header>

      <form v-if="!result" class="scan" @submit.prevent="submit">
        <div class="viewfinder" :class="{ busy }" aria-hidden="true">
          <span class="corner tl" /><span class="corner tr" /><span class="corner bl" /><span
            class="corner br"
          />
          <span class="beam" />
          <svg viewBox="0 0 24 24" class="qr-icon">
            <path
              d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 19h2M19 14h2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          <p>{{ busy ? "Checking…" : input ? "Ticket ready" : "Waiting for a ticket" }}</p>
        </div>
        <label class="field">
          <span>Ticket code</span>
          <input
            ref="field"
            v-model="input"
            required
            autocomplete="off"
            spellcheck="false"
            placeholder="Scan or paste a code"
          />
        </label>
        <div v-if="needsLogin" class="login">
          <label class="field">
            <span>Gate user</span>
            <input v-model="auth.username" autocomplete="username" />
          </label>
          <label class="field">
            <span>Password</span>
            <input v-model="auth.password" type="password" autocomplete="current-password" />
          </label>
        </div>
        <button type="submit" class="btn block" :disabled="busy || !input">Validate</button>
      </form>

      <div v-else class="result" :class="result.ok ? 'ok' : 'fail'" role="status">
        <div class="badge" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path v-if="result.ok" d="M14 25l7 7 14-15" />
            <path v-else d="M16 16l16 16M32 16L16 32" />
          </svg>
        </div>
        <p class="r-title">{{ result.title }}</p>
        <p class="r-text">{{ result.text }}</p>
        <button ref="again" type="button" class="next" @click="reset">Scan next</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device {
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  padding: 14px;
  border-radius: 40px;
  background: linear-gradient(160deg, #2b2730, #0f0d12);
  box-shadow:
    0 40px 80px -30px rgba(0, 0, 0, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}
.screen {
  position: relative;
  min-height: 470px;
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  background: #08070a;
  overflow: hidden;
}
.status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.status .count {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--faint);
}
.status .dot.live {
  background: var(--ok);
  box-shadow: 0 0 8px var(--ok);
}
.scan {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 4px 18px 18px;
}
.viewfinder {
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  height: 190px;
  border-radius: 18px;
  background: radial-gradient(circle at 50% 40%, #1b1820, #0b0a0d);
  color: var(--faint);
  overflow: hidden;
}
.viewfinder p {
  font-size: 12px;
  letter-spacing: 0.08em;
}
.qr-icon {
  width: 46px;
  height: 46px;
}
.corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 3px solid var(--accent);
  border-radius: 4px;
}
.tl {
  top: 16px;
  left: 16px;
  border-right: 0;
  border-bottom: 0;
}
.tr {
  top: 16px;
  right: 16px;
  border-left: 0;
  border-bottom: 0;
}
.bl {
  bottom: 16px;
  left: 16px;
  border-right: 0;
  border-top: 0;
}
.br {
  bottom: 16px;
  right: 16px;
  border-left: 0;
  border-top: 0;
}
.beam {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 20px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  box-shadow: 0 0 12px var(--accent);
  animation: sweep 2.4s ease-in-out infinite alternate;
}
.viewfinder.busy .beam {
  animation-duration: 0.5s;
}
@keyframes sweep {
  to {
    top: calc(100% - 22px);
  }
}
.field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.field input {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
.login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.scan .btn {
  margin-top: auto;
}

.result {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  animation: flash 0.45s var(--ease);
}
.result.ok {
  background: radial-gradient(circle at 50% 35%, #1fb877, #0b5a3a 75%);
}
.result.fail {
  background: radial-gradient(circle at 50% 35%, #ef3e4a, #6b0d1c 75%);
}
.badge {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: 0 0 0 10px rgba(255, 255, 255, 0.06);
  animation: badge 0.5s var(--ease);
}
.badge svg {
  width: 56px;
  height: 56px;
  fill: none;
  stroke: #fff;
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.badge path {
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: draw 0.45s 0.15s var(--ease) forwards;
}
.r-title {
  font-family: var(--serif);
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
  color: #fff;
}
.r-text {
  max-width: 240px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}
.next {
  margin-top: 18px;
  min-height: 44px;
  padding: 0 22px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.15);
  color: #fff;
  font-weight: 700;
}
.next:hover {
  background: rgba(0, 0, 0, 0.3);
}
.next:focus-visible {
  outline-color: #fff;
}
@keyframes flash {
  from {
    opacity: 0;
    transform: scale(1.04);
  }
}
@keyframes badge {
  from {
    transform: scale(0.4);
  }
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
