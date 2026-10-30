<script setup lang="ts">
import { reactive, ref, watch } from "vue";

import { ApiError, type GateCredentials, type Redeemed } from "../api";

const props = defineProps<{
  code: string;
  needsLogin: boolean;
  redeem: (code: string, auth?: GateCredentials) => Promise<Redeemed>;
}>();
const emit = defineEmits<{ redeemed: [code: string] }>();

const input = ref(props.code);
const auth = reactive<GateCredentials>({ username: "gate", password: "" });
const result = ref<{ ok: boolean; text: string } | null>(null);
const busy = ref(false);

watch(
  () => props.code,
  (code) => {
    input.value = code;
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
    result.value = { ok: true, text: `Welcome — ${t.section}, row ${t.row}, seat ${t.number}` };
    emit("redeemed", input.value.trim());
  } catch (err) {
    const code = err instanceof ApiError ? err.code : "error";
    const when =
      err instanceof ApiError && typeof err.payload.redeemed_at === "string"
        ? ` at ${new Date(err.payload.redeemed_at).toLocaleTimeString()}`
        : "";
    result.value = { ok: false, text: `${messages[code] ?? "Check failed"}${when}` };
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="gate" @submit.prevent="submit">
    <h2>Entrance</h2>
    <label>
      Ticket code
      <input v-model="input" required autocomplete="off" placeholder="Scan or paste a code" />
    </label>
    <div v-if="needsLogin" class="login">
      <label>Gate user <input v-model="auth.username" autocomplete="username" /></label>
      <label>
        Password
        <input v-model="auth.password" type="password" autocomplete="current-password" />
      </label>
    </div>
    <button type="submit" :disabled="busy || !input">Validate</button>
    <p v-if="result" class="result" :class="result.ok ? 'ok' : 'fail'" role="status">
      {{ result.text }}
    </p>
  </form>
</template>

<style scoped>
.gate {
  display: grid;
  gap: 10px;
}
h2 {
  margin: 0;
  font-size: 18px;
}
label {
  display: grid;
  gap: 4px;
  font-size: 14px;
  color: var(--muted);
}
.login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.result {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  font-weight: 600;
}
.ok {
  background: #e3f4ea;
  color: #1d6b3d;
}
.fail {
  background: #fbe6e3;
  color: var(--danger);
}
</style>
