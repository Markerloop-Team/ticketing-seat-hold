import { computed, ref } from "vue";

import type { Order } from "../api";

/**
 * The buyer's ticket wallet ("My tickets"). In production it is the account's
 * order history; in the demo it lives as long as the in-browser API does.
 */
export interface WalletEntry {
  order: Order;
  slug: string;
  eventId: number;
  startsAt: string;
  venue: string;
  /** Tier name per ticket price, for the ticket stub. */
  tiers: Record<string, string>;
  /** Bonus points earned on this order. */
  points: number;
}

const entries = ref<WalletEntry[]>([]);
const redeemed = ref(new Set<string>());
/** A ticket the buyer sent to the gate from the wallet; the event page picks it up. */
const pendingGate = ref<string | null>(null);

export function useWallet() {
  return {
    entries,
    redeemed,
    pendingGate,
    ticketCount: computed(() => entries.value.reduce((n, e) => n + e.order.tickets.length, 0)),
    points: computed(() => entries.value.reduce((n, e) => n + e.points, 0)),
    add(entry: WalletEntry) {
      if (!entries.value.some((e) => e.order.token === entry.order.token)) {
        entries.value = [entry, ...entries.value];
      }
    },
    markRedeemed(code: string) {
      redeemed.value = new Set([...redeemed.value, code]);
    },
  };
}
