import { curtainUp, productions, venues, type VenueKey } from "../content/programme";
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

const HALL_SVG = `<svg viewBox="0 0 600 330" xmlns="http://www.w3.org/2000/svg">
  <rect x="170" y="18" width="260" height="34" rx="6" class="stage"/>
  <path id="stalls" d="M239.8 76.9 A90 90 0 0 0 360.2 76.9 L494 225.5 A290 290 0 0 1 106 225.5 Z"/>
  <path id="balcony-left" d="M151.4 143.8 A200 200 0 0 1 106.8 61.8 L39.2 79.9 A270 270 0 0 0 99.4 190.6 Z"/>
  <path id="balcony-right" d="M448.6 143.8 A200 200 0 0 0 493.2 61.8 L560.8 79.9 A270 270 0 0 1 500.6 190.6 Z"/>
</svg>`;

/** A thrust stage with straight raked rows and two side galleries. */
const STUDIO_SVG = `<svg viewBox="0 0 600 330" xmlns="http://www.w3.org/2000/svg">
  <rect x="200" y="18" width="200" height="60" rx="6" class="stage"/>
  <path id="front" d="M180 96 L420 96 L432 170 L168 170 Z"/>
  <path id="rear" d="M160 184 L440 184 L456 292 L144 292 Z"/>
  <path id="gallery-left" d="M40 70 L150 96 L130 292 L52 260 Z"/>
  <path id="gallery-right" d="M560 70 L450 96 L470 292 L548 260 Z"/>
</svg>`;

interface SectionDef {
  name: string;
  svg_element_id: string;
  rows: number;
  perRow: number;
  /** Price tier index for a row. */
  tier: (row: number) => number;
  layout: "arc" | "straight";
  radius?: number;
  aisle?: number;
}

interface VenueDef {
  name: string;
  svg: string;
  tiers: Array<{ name: string; color: string }>;
  sections: SectionDef[];
}

const VENUES: Record<VenueKey, VenueDef> = {
  "grand-hall": {
    name: venues["grand-hall"].name,
    svg: HALL_SVG,
    tiers: [
      { name: "Premier", color: "#e3b25a" },
      { name: "Parterre", color: "#d0607a" },
      { name: "Balcony", color: "#7d9ad0" },
      { name: "Amphitheatre", color: "#9b7fd1" },
    ],
    sections: [
      { name: "Parterre", svg_element_id: "stalls", rows: 8, perRow: 14, layout: "arc", radius: 700, aisle: 10,
        tier: (row) => (row <= 2 ? 0 : row <= 5 ? 1 : 3) },
      { name: "Balcony Left", svg_element_id: "balcony-left", rows: 6, perRow: 4, layout: "arc", radius: 520,
        tier: () => 2 },
      { name: "Balcony Right", svg_element_id: "balcony-right", rows: 6, perRow: 4, layout: "arc", radius: 520,
        tier: () => 2 },
    ],
  },
  studio: {
    name: venues.studio.name,
    svg: STUDIO_SVG,
    tiers: [
      { name: "Front tables", color: "#e3b25a" },
      { name: "Stalls", color: "#3fb8a4" },
      { name: "Gallery", color: "#7d9ad0" },
    ],
    sections: [
      { name: "Front Stalls", svg_element_id: "front", rows: 4, perRow: 12, layout: "straight", aisle: 12,
        tier: (row) => (row <= 2 ? 0 : 1) },
      { name: "Rear Stalls", svg_element_id: "rear", rows: 6, perRow: 16, layout: "straight", aisle: 12,
        tier: () => 1 },
      { name: "Gallery Left", svg_element_id: "gallery-left", rows: 5, perRow: 4, layout: "straight",
        tier: () => 2 },
      { name: "Gallery Right", svg_element_id: "gallery-right", rows: 5, perRow: 4, layout: "straight",
        tier: () => 2 },
    ],
  },
};

/** Ticket prices per tier, as the box office would set them for each show. */
export const PRICES: Record<string, number[]> = {
  "swan-lake": [15000, 9000, 5000, 7000],
  "the-nutcracker": [18000, 11000, 6000, 8500],
  "romeo-and-juliet": [16000, 9500, 5500, 7500],
  "la-traviata": [15000, 9000, 5000, 7000],
  carmen: [16000, 9500, 5500, 7500],
  "the-inspector": [7000, 5000, 3500],
  "midnight-jazz": [7500, 5000, 3500],
  "late-night-stand-up": [9000, 6500, 4200],
};

/** How full each show already is: one seat in `n` is sold. Swan Lake keeps the original scatter. */
const SOLD_EVERY: Record<string, number> = {
  "swan-lake": 11,
  "the-nutcracker": 3,
  "late-night-stand-up": 4,
  carmen: 5,
};

/**
 * Seat coordinates as a venue admin would draw them: rows are arcs facing the
 * stage (with a centre aisle in the parterre), or straight rows in the studio.
 */
function seatPosition(def: SectionDef, row: number, number: number) {
  const centre = (def.perRow + 1) / 2;
  const spacing = 26;
  const aisle = def.aisle ?? 0;
  const along = (number - centre) * spacing + (number > centre ? aisle : number < centre ? -aisle : 0);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  if (def.layout === "straight") return { x: r1(220 + along), y: r1(40 + (row - 1) * 30) };
  const radius = def.radius! + (row - 1) * 30;
  const angle = along / radius;
  return {
    x: r1(220 + radius * Math.sin(angle)),
    y: r1(40 + radius * Math.cos(angle) - (radius - (row - 1) * 30)),
  };
}

interface SeatRow {
  seat: Omit<Seat, "status">;
  eventId: number;
  sectionId: number;
  status: "free" | "held" | "sold";
  holdToken: string | null;
  heldUntil: number;
}

interface HoldRow {
  token: string;
  eventId: number;
  status: Hold["status"];
  expiresAt: number;
  seatIds: number[];
}

interface TicketRow {
  code: string;
  seatId: number;
  redeemedAt: string | null;
}

interface SectionRow {
  id: number;
  name: string;
  svg_element_id: string;
}

interface EventRow {
  id: number;
  slug: string;
  title: string;
  starts_at: string;
  max_seats_per_hold: number;
  venue: string;
  svg: string;
  sections: SectionRow[];
  groups: PriceGroup[];
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

  const events = new Map<string, EventRow>();
  const seats = new Map<number, SeatRow>();
  const holds = new Map<string, HoldRow>();
  const orders = new Map<string, Order>();
  const tickets = new Map<string, TicketRow>();

  // Ids are global like database keys: Swan Lake comes first, so its seats are 1..160.
  let nextSeatId = 1;
  let nextSectionId = 1;
  let nextGroupId = 1;
  productions.forEach((p, index) => {
    const venue = VENUES[p.venue];
    const prices = PRICES[p.slug];
    const groups = venue.tiers.map((t, i) => ({
      id: nextGroupId++,
      name: t.name,
      color: t.color,
      price: prices[i].toFixed(2),
    }));
    const event: EventRow = {
      id: index + 1,
      slug: p.slug,
      title: p.title,
      starts_at: curtainUp(p, now()),
      max_seats_per_hold: 5,
      venue: venue.name,
      svg: venue.svg,
      sections: [],
      groups,
    };
    const soldEvery = SOLD_EVERY[p.slug] ?? 7;
    const firstSeat = nextSeatId;
    for (const def of venue.sections) {
      const section = { id: nextSectionId++, name: def.name, svg_element_id: def.svg_element_id };
      event.sections.push(section);
      for (let row = 1; row <= def.rows; row++) {
        for (let number = 1; number <= def.perRow; number++) {
          const id = nextSeatId++;
          // Deterministic "already sold" scatter so the map doesn't look empty.
          const sold = ((id - firstSeat + 1) * 7919) % soldEvery === 0;
          seats.set(id, {
            seat: { id, row, number, ...seatPosition(def, row, number), price_group: groups[def.tier(row)].id },
            eventId: event.id,
            sectionId: section.id,
            status: sold ? "sold" : "free",
            holdToken: null,
            heldUntil: 0,
          });
        }
      }
    }
    events.set(p.slug, event);
    // Someone else is mid-checkout on a few seats; their hold lapses in two minutes.
    const other: HoldRow = {
      token: crypto.randomUUID(),
      eventId: event.id,
      status: "active",
      expiresAt: now() + 120_000,
      seatIds: [32, 33, 34].map((n) => firstSeat + n),
    };
    holds.set(other.token, other);
    for (const id of other.seatIds) claim(seats.get(id)!, other);
  });

  function findEvent(slug: string): EventRow {
    const e = events.get(slug);
    if (!e) throw new ApiError(404, "not_found");
    return e;
  }

  function eventById(id: number): EventRow {
    return [...events.values()].find((e) => e.id === id)!;
  }

  function sectionName(row: SeatRow): string {
    return eventById(row.eventId).sections.find((s) => s.id === row.sectionId)!.name;
  }

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
      event: eventById(h.eventId).slug,
      status: h.status,
      expires_at: new Date(h.expiresAt).toISOString(),
      seconds_left: h.status === "active" ? Math.max(0, Math.floor((h.expiresAt - now()) / 1000)) : 0,
      seat_ids: [...h.seatIds].sort((a, b) => a - b),
      amount: amount.toFixed(2),
    };
  }

  function price(seatId: number): number {
    const row = seats.get(seatId)!;
    const group = eventById(row.eventId).groups.find((g) => g.id === row.seat.price_group)!;
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
        const { sections, groups: _groups, ...event } = findEvent(slug);
        return {
          ...event,
          sections: sections.map(({ id, name, svg_element_id }) => ({
            id,
            name,
            svg_element_id,
            available: [...seats.values()].filter(
              (s) => s.sectionId === id && effectiveStatus(s) === "free",
            ).length,
          })),
        };
      }),

    getSeats: (slug, sectionId) =>
      delay(() => {
        const event = findEvent(slug);
        const section = event.sections.find((s) => s.id === sectionId);
        if (!section) throw new ApiError(404, "not_found");
        const rows = [...seats.values()].filter((s) => s.sectionId === sectionId);
        const groupIds = new Set(rows.map((r) => r.seat.price_group));
        return {
          section: { id: section.id, name: section.name },
          price_groups: event.groups.filter((g) => groupIds.has(g.id)),
          seats: rows.map((r) => ({ ...r.seat, status: effectiveStatus(r) })),
        };
      }),

    createHold: (slug, seatIds) =>
      delay(() => {
        const event = findEvent(slug);
        const ids = [...new Set(seatIds)].sort((a, b) => a - b);
        if (!ids.length || ids.length > event.max_seats_per_hold) {
          throw new ApiError(400, "hold_limit_exceeded", { limit: event.max_seats_per_hold });
        }
        const taken = ids.filter((id) => {
          const row = seats.get(id);
          return !row || row.eventId !== event.id || effectiveStatus(row) !== "free";
        });
        if (taken.length) throw new ApiError(409, "seats_unavailable", { seat_ids: taken });

        const hold: HoldRow = {
          token: crypto.randomUUID(),
          eventId: event.id,
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
            section: sectionName(row),
            row: row.seat.row,
            number: row.seat.number,
            price: price(id).toFixed(2),
          };
        });
        h.status = "confirmed";
        const order: Order = {
          token: h.token,
          event: eventById(h.eventId).title,
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
        const row = seats.get(t.seatId)!;
        if (eventId !== row.eventId) throw new ApiError(409, "wrong_event");
        if (t.redeemedAt) {
          throw new ApiError(409, "already_redeemed", { redeemed_at: t.redeemedAt });
        }
        t.redeemedAt = new Date(now()).toISOString();
        return {
          section: sectionName(row),
          row: row.seat.row,
          number: row.seat.number,
          redeemed_at: t.redeemedAt,
        };
      }),
  };
}
