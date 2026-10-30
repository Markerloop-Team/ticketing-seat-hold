import {
  ApiError,
  type EventInfo,
  type Hold,
  type Order,
  type PriceGroup,
  type Seat,
  type TicketingApi,
} from "./types";

/**
 * In-browser stand-in for the Django API, used for the static demo.
 * It follows the same rules as the backend (all-or-nothing holds, TTL with lazy
 * takeover, idempotent confirm, single redemption) but keeps state in memory.
 */

const HALL_SVG = `<svg viewBox="0 0 600 420" xmlns="http://www.w3.org/2000/svg">
  <rect x="180" y="20" width="240" height="40" rx="6" class="stage"/>
  <path id="stalls" d="M150 100 H450 L480 260 H120 Z"/>
  <path id="balcony-left" d="M40 120 L110 110 L100 330 L30 320 Z"/>
  <path id="balcony-right" d="M490 110 L560 120 L570 320 L500 330 Z"/>
</svg>`;

const SECTIONS = [
  { id: 1, name: "Stalls", svg_element_id: "stalls", rows: 8, perRow: 14 },
  { id: 2, name: "Balcony Left", svg_element_id: "balcony-left", rows: 6, perRow: 4 },
  { id: 3, name: "Balcony Right", svg_element_id: "balcony-right", rows: 6, perRow: 4 },
];

const PRICE_GROUPS: PriceGroup[] = [
  { id: 1, name: "VIP", color: "#d4543a", price: "15000.00" },
  { id: 2, name: "Stalls", color: "#3a7bd4", price: "9000.00" },
  { id: 3, name: "Balcony", color: "#3aa57a", price: "5000.00" },
];

interface SeatRow {
  seat: Omit<Seat, "status">;
  sectionId: number;
  status: "free" | "held" | "sold";
  holdToken: string | null;
  heldUntil: number;
}

interface HoldRow {
  token: string;
  status: Hold["status"];
  expiresAt: number;
  seatIds: number[];
}

interface TicketRow {
  code: string;
  seatId: number;
  redeemedAt: string | null;
}

export interface MockOptions {
  holdTtlSeconds?: number;
  latencyMs?: number;
  now?: () => number;
}

export function createMockApi(options: MockOptions = {}): TicketingApi {
  const ttl = (options.holdTtlSeconds ?? 15 * 60) * 1000;
  const latency = options.latencyMs ?? 0;
  const now = options.now ?? Date.now;

  const event = {
    id: 1,
    slug: "swan-lake",
    title: "Swan Lake",
    starts_at: new Date(now() + 14 * 86_400_000).toISOString(),
    max_seats_per_hold: 5,
    venue: "Grand Hall",
    svg: HALL_SVG,
  };

  const seats = new Map<number, SeatRow>();
  const holds = new Map<string, HoldRow>();
  const orders = new Map<string, Order>();
  const tickets = new Map<string, TicketRow>();

  let nextSeatId = 1;
  for (const section of SECTIONS) {
    for (let row = 1; row <= section.rows; row++) {
      for (let number = 1; number <= section.perRow; number++) {
        const id = nextSeatId++;
        const group = section.id !== 1 ? 3 : row <= 2 ? 1 : 2;
        // Deterministic "already sold" scatter so the map doesn't look empty.
        const sold = (id * 7919) % 11 === 0;
        seats.set(id, {
          seat: { id, row, number, x: number * 24, y: row * 28, price_group: group },
          sectionId: section.id,
          status: sold ? "sold" : "free",
          holdToken: null,
          heldUntil: 0,
        });
      }
    }
  }
  // Someone else is mid-checkout on a few seats; their hold lapses in two minutes.
  const other: HoldRow = {
    token: crypto.randomUUID(),
    status: "active",
    expiresAt: now() + 120_000,
    seatIds: [33, 34, 35],
  };
  holds.set(other.token, other);
  for (const id of other.seatIds) claim(seats.get(id)!, other);

  function claim(row: SeatRow, hold: HoldRow) {
    row.status = "held";
    row.holdToken = hold.token;
    row.heldUntil = hold.expiresAt;
  }

  function effectiveStatus(row: SeatRow): Seat["status"] {
    return row.status === "held" && row.heldUntil <= now() ? "free" : row.status;
  }

  function holdView(h: HoldRow): Hold {
    const amount = h.seatIds.reduce((sum, id) => sum + price(id), 0);
    return {
      token: h.token,
      event: event.slug,
      status: h.status,
      expires_at: new Date(h.expiresAt).toISOString(),
      seconds_left: h.status === "active" ? Math.max(0, Math.floor((h.expiresAt - now()) / 1000)) : 0,
      seat_ids: [...h.seatIds].sort((a, b) => a - b),
      amount: amount.toFixed(2),
    };
  }

  function price(seatId: number): number {
    const group = PRICE_GROUPS.find((g) => g.id === seats.get(seatId)!.seat.price_group)!;
    return Number(group.price);
  }

  function activeHold(token: string): HoldRow {
    const h = holds.get(token);
    if (!h) throw new ApiError(404, "not_found");
    if (h.status !== "active" || h.expiresAt <= now()) {
      throw new ApiError(409, "hold_not_active", { detail: "Hold has expired or was released." });
    }
    return h;
  }

  // Mock signature only: shape matches the backend's `<id>:<sig>`, security does not.
  function sign(id: string): string {
    let h = 0x811c9dc5;
    for (const ch of `ticket-qr:${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
    return `${id}:${(h >>> 0).toString(36)}`;
  }

  const delay = <T>(value: () => T): Promise<T> =>
    new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(value());
        } catch (err) {
          reject(err);
        }
      }, latency),
    );

  return {
    isMock: true,

    getEvent: (slug) =>
      delay((): EventInfo => {
        if (slug !== event.slug) throw new ApiError(404, "not_found");
        return {
          ...event,
          sections: SECTIONS.map(({ id, name, svg_element_id }) => ({
            id,
            name,
            svg_element_id,
            available: [...seats.values()].filter(
              (s) => s.sectionId === id && effectiveStatus(s) === "free",
            ).length,
          })),
        };
      }),

    getSeats: (_slug, sectionId) =>
      delay(() => {
        const section = SECTIONS.find((s) => s.id === sectionId);
        if (!section) throw new ApiError(404, "not_found");
        const rows = [...seats.values()].filter((s) => s.sectionId === sectionId);
        const groupIds = new Set(rows.map((r) => r.seat.price_group));
        return {
          section: { id: section.id, name: section.name },
          price_groups: PRICE_GROUPS.filter((g) => groupIds.has(g.id)),
          seats: rows.map((r) => ({ ...r.seat, status: effectiveStatus(r) })),
        };
      }),

    createHold: (_slug, seatIds) =>
      delay(() => {
        const ids = [...new Set(seatIds)].sort((a, b) => a - b);
        if (!ids.length || ids.length > event.max_seats_per_hold) {
          throw new ApiError(400, "hold_limit_exceeded", { limit: event.max_seats_per_hold });
        }
        const taken = ids.filter((id) => {
          const row = seats.get(id);
          return !row || effectiveStatus(row) !== "free";
        });
        if (taken.length) throw new ApiError(409, "seats_unavailable", { seat_ids: taken });

        const hold: HoldRow = {
          token: crypto.randomUUID(),
          status: "active",
          expiresAt: now() + ttl,
          seatIds: ids,
        };
        holds.set(hold.token, hold);
        for (const id of ids) claim(seats.get(id)!, hold);
        return holdView(hold);
      }),

    releaseHold: (token) =>
      delay(() => {
        const h = activeHold(token);
        h.status = "released";
        for (const id of h.seatIds) {
          const row = seats.get(id)!;
          if (row.holdToken === token && row.status === "held") {
            Object.assign(row, { status: "free", holdToken: null, heldUntil: 0 });
          }
        }
      }),

    confirmPayment: (token, body) =>
      delay(() => {
        const existing = [...orders.values()].find((o) => o.token === token);
        if (existing) return existing;
        const h = activeHold(token);
        const tix = h.seatIds.map((id) => {
          const row = seats.get(id)!;
          row.status = "sold";
          const code = sign(crypto.randomUUID().replaceAll("-", ""));
          tickets.set(code, { code, seatId: id, redeemedAt: null });
          return {
            code,
            section: SECTIONS.find((s) => s.id === row.sectionId)!.name,
            row: row.seat.row,
            number: row.seat.number,
            price: price(id).toFixed(2),
          };
        });
        h.status = "confirmed";
        const order: Order = {
          token: h.token,
          event: event.title,
          email: body.email,
          amount: holdView(h).amount,
          paid_at: new Date(now()).toISOString(),
          tickets: tix,
        };
        orders.set(h.token, order);
        return order;
      }),

    redeem: (code, eventId) =>
      delay(() => {
        const [id] = code.split(":");
        if (!id || sign(id) !== code) throw new ApiError(400, "invalid_ticket_code");
        const t = tickets.get(code);
        if (!t) throw new ApiError(404, "ticket_not_found");
        if (eventId !== event.id) throw new ApiError(409, "wrong_event");
        if (t.redeemedAt) {
          throw new ApiError(409, "already_redeemed", { redeemed_at: t.redeemedAt });
        }
        t.redeemedAt = new Date(now()).toISOString();
        const row = seats.get(t.seatId)!;
        return {
          section: SECTIONS.find((s) => s.id === row.sectionId)!.name,
          row: row.seat.row,
          number: row.seat.number,
          redeemed_at: t.redeemedAt,
        };
      }),
  };
}
