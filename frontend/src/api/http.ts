import { ApiError, type TicketingApi } from "./types";

export function createHttpApi(baseUrl: string): TicketingApi {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const resp = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    if (resp.status === 204) return undefined as T;
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new ApiError(resp.status, body.code ?? `http_${resp.status}`, body);
    return body as T;
  }

  const post = (body: unknown, headers?: HeadersInit): RequestInit => ({
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });

  return {
    isMock: false,
    getEvent: (slug) => request(`/events/${slug}/`),
    getSeats: (slug, sectionId) => request(`/events/${slug}/sections/${sectionId}/seats/`),
    createHold: (slug, seatIds) => request(`/events/${slug}/holds/`, post({ seat_ids: seatIds })),
    releaseHold: (token) => request(`/holds/${token}/`, { method: "DELETE" }),
    confirmPayment: (token, body) => request(`/holds/${token}/confirm/`, post(body)),
    redeem: (code, eventId, auth) =>
      request(
        "/validator/redeem/",
        post(
          { code, event_id: eventId },
          auth ? { Authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` } : {},
        ),
      ),
  };
}
