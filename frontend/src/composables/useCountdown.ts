import { computed, onScopeDispose, ref, watch, type Ref } from "vue";

/**
 * Seconds left until `deadline` (epoch ms). The deadline should be derived from
 * the server's `seconds_left`, not its `expires_at`, so a skewed client clock
 * doesn't shorten or stretch the hold.
 */
export function useCountdown(deadline: Ref<number>, onExpire?: () => void) {
  const now = ref(Date.now());
  const remaining = computed(() => Math.max(0, Math.ceil((deadline.value - now.value) / 1000)));

  let fired = false;
  const timer = setInterval(() => (now.value = Date.now()), 250);
  onScopeDispose(() => clearInterval(timer));

  watch(deadline, () => {
    fired = false;
    now.value = Date.now();
  });
  watch(
    remaining,
    (left) => {
      if (left === 0 && !fired) {
        fired = true;
        onExpire?.();
      }
    },
    { immediate: true },
  );

  return { remaining };
}
