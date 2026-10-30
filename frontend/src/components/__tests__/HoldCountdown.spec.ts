import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HoldCountdown from "../HoldCountdown.vue";

describe("HoldCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T19:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("counts down from the deadline and flags the last minute", async () => {
    const w = mount(HoldCountdown, { props: { deadline: Date.now() + 15 * 60_000 } });
    expect(w.text()).toContain("15:00");

    await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000);
    expect(w.text()).toContain("0:59");
    expect(w.classes()).toContain("urgent");
  });

  it("emits expired exactly once", async () => {
    const w = mount(HoldCountdown, { props: { deadline: Date.now() + 2_000 } });

    await vi.advanceTimersByTimeAsync(5_000);

    expect(w.text()).toContain("0:00");
    expect(w.emitted("expired")).toHaveLength(1);
  });

  it("restarts when the deadline moves", async () => {
    const w = mount(HoldCountdown, { props: { deadline: Date.now() + 1_000 } });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(w.emitted("expired")).toHaveLength(1);

    await w.setProps({ deadline: Date.now() + 60_000 });
    expect(w.text()).toContain("1:00");
    await vi.advanceTimersByTimeAsync(61_000);
    expect(w.emitted("expired")).toHaveLength(2);
  });
});
