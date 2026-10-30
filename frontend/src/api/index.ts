import { createHttpApi } from "./http";
import { createMockApi } from "./mock";
import type { TicketingApi } from "./types";

export * from "./types";

function create(): TicketingApi {
  const url = import.meta.env.VITE_API_URL;
  if (url) return createHttpApi(url);
  // `?hold_ttl=30` shortens the mock hold to see expiry without waiting 15 minutes.
  const ttl = Number(new URLSearchParams(location.search).get("hold_ttl")) || undefined;
  return createMockApi({ holdTtlSeconds: ttl, latencyMs: 150 });
}

export const api = create();
