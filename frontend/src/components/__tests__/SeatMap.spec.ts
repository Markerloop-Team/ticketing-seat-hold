import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import type { PriceGroup, Seat } from "../../api";
import SeatMap from "../SeatMap.vue";

const groups: PriceGroup[] = [
  { id: 1, name: "VIP", color: "#d4543a", price: "15000.00" },
  { id: 2, name: "Stalls", color: "#3a7bd4", price: "9000.00" },
];

const seats: Seat[] = [
  { id: 11, row: 1, number: 1, x: 24, y: 28, price_group: 1, status: "free" },
  { id: 12, row: 1, number: 2, x: 48, y: 28, price_group: 1, status: "held" },
  { id: 13, row: 1, number: 3, x: 72, y: 28, price_group: 1, status: "sold" },
  { id: 21, row: 2, number: 1, x: 24, y: 56, price_group: 2, status: "free" },
  { id: 22, row: 2, number: 2, x: 48, y: 56, price_group: 2, status: "free" },
];

function render(props: Record<string, unknown> = {}) {
  return mount(SeatMap, { props: { seats, priceGroups: groups, selected: [], ...props } });
}

const seat = (w: ReturnType<typeof render>, id: number) => w.get(`[data-seat="${id}"]`);

describe("SeatMap", () => {
  it("renders every seat with its state and price-group colour", () => {
    const w = render({ selected: [21] });

    expect(w.findAll("circle.seat")).toHaveLength(5);
    expect(seat(w, 11).attributes("data-state")).toBe("free");
    expect(seat(w, 11).attributes("style")).toContain("fill: #d4543a");
    expect(seat(w, 12).attributes("data-state")).toBe("held");
    expect(seat(w, 13).attributes("data-state")).toBe("sold");
    expect(seat(w, 21).attributes("data-state")).toBe("selected");
    expect(seat(w, 21).attributes("style") ?? "").not.toContain("fill");
    expect(seat(w, 11).attributes("aria-label")).toBe("Row 1, seat 1, VIP 15,000 ₸");
  });

  it("toggles free seats and ignores taken ones", async () => {
    const w = render();

    await seat(w, 11).trigger("click");
    await seat(w, 12).trigger("click");
    await seat(w, 13).trigger("click");
    expect(w.emitted("update:selected")).toEqual([[[11]]]);

    await w.setProps({ selected: [11] });
    await seat(w, 11).trigger("click");
    expect(w.emitted("update:selected")?.at(-1)).toEqual([[]]);
  });

  it("supports keyboard selection", async () => {
    const w = render();
    await seat(w, 22).trigger("keydown", { key: "Enter" });
    expect(w.emitted("update:selected")).toEqual([[[22]]]);
  });

  it("stops at the per-order limit", async () => {
    const w = render({ selected: [11, 21], maxSelected: 2 });

    await seat(w, 22).trigger("click");

    expect(w.emitted("update:selected")).toBeUndefined();
    expect(w.emitted("limit")).toEqual([[2]]);
  });

  it("is read-only while disabled", async () => {
    const w = render({ disabled: true });
    await seat(w, 11).trigger("click");
    expect(w.emitted("update:selected")).toBeUndefined();
    expect(seat(w, 11).attributes("tabindex")).toBe("-1");
  });
});
