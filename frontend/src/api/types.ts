export type SeatStatus = "free" | "held" | "sold";

export interface SectionSummary {
  id: number;
  name: string;
  svg_element_id: string;
  available: number;
}

export interface EventInfo {
  id: number;
  slug: string;
  title: string;
  starts_at: string;
  max_seats_per_hold: number;
  venue: string;
  svg: string;
  sections: SectionSummary[];
}

export interface PriceGroup {
  id: number;
  name: string;
  color: string;
  price: string;
}

export interface Seat {
  id: number;
  row: number;
  number: number;
  x: number;
  y: number;
  price_group: number;
  status: SeatStatus;
}

export interface SectionSeats {
  section: { id: number; name: string };
  price_groups: PriceGroup[];
  seats: Seat[];
}

export interface Hold {
  token: string;
  event: string;
  status: "active" | "confirmed" | "released" | "expired";
  expires_at: string;
  seconds_left: number;
  seat_ids: number[];
  amount: string;
}

export interface Ticket {
  code: string;
  section: string;
  row: number;
  number: number;
  price: string;
}

export interface Order {
  token: string;
  event: string;
  email: string;
  amount: string;
  paid_at: string;
  tickets: Ticket[];
}

export interface Redeemed {
  section: string;
  row: number;
  number: number;
  redeemed_at: string;
}

export interface GateCredentials {
  username: string;
  password: string;
}

export interface TicketingApi {
  getEvent(slug: string): Promise<EventInfo>;
  getSeats(slug: string, sectionId: number): Promise<SectionSeats>;
  createHold(slug: string, seatIds: number[]): Promise<Hold>;
  releaseHold(token: string): Promise<void>;
  confirmPayment(token: string, body: { payment_reference: string; email: string }): Promise<Order>;
  redeem(code: string, eventId: number, auth?: GateCredentials): Promise<Redeemed>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly payload: Record<string, unknown> = {},
  ) {
    super(typeof payload.detail === "string" ? payload.detail : code);
  }
}
