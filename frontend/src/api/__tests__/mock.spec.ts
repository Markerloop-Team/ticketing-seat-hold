import { describe, expect, it } from "vitest";

import { ApiError } from "../types";
import { createMockApi } from "../mock";

function setup() {
  let t = Date.parse("2026-01-01T19:00:00Z");
  const api = createMockApi({ now: () => t });
  return { api, advance: (ms: number) => (t += ms) };
}

const rejection = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected rejection");
    },
    (err: ApiError) => err,
  );

async function freeSeats(api: ReturnType<typeof createMockApi>, n: number) {
  const { seats } = await api.getSeats("swan-lake", 1);
  return seats.filter((s) => s.status === "free").slice(0, n).map((s) => s.id);
}

describe("mock api", () => {
  it("follows the backend flow from hold to single redemption", async () => {
    const { api } = setup();
    const ids = await freeSeats(api, 2);

    const hold = await api.createHold("swan-lake", ids);
    expect(hold.seconds_left).toBe(900);

    const order = await api.confirmPayment(hold.token, {
      payment_reference: "demo-1",
      email: "guest@example.com",
    });
    expect(order.tickets).toHaveLength(2);
    expect(await api.confirmPayment(hold.token, { payment_reference: "demo-1", email: "" })).toBe(
      order,
    );

    const code = order.tickets[0].code;
    await api.redeem(code, 1);
    expect((await rejection(api.redeem(code, 1))).code).toBe("already_redeemed");
    expect((await rejection(api.redeem(`${code}x`, 1))).code).toBe("invalid_ticket_code");
  });

  it("rejects overlapping holds all-or-nothing", async () => {
    const { api } = setup();
    const [a, b, c] = await freeSeats(api, 3);
    await api.createHold("swan-lake", [a, b]);

    const err = await rejection(api.createHold("swan-lake", [b, c]));

    expect(err.code).toBe("seats_unavailable");
    expect(err.payload.seat_ids).toEqual([b]);
    await api.createHold("swan-lake", [c]);
  });

  it("frees seats once the hold lapses and refuses late payment", async () => {
    const { api, advance } = setup();
    const ids = await freeSeats(api, 1);
    const hold = await api.createHold("swan-lake", ids);

    advance(15 * 60_000);

    const late = await rejection(api.confirmPayment(hold.token, { payment_reference: "x", email: "" }));
    expect(late.code).toBe("hold_not_active");
    await api.createHold("swan-lake", ids);
  });
});
