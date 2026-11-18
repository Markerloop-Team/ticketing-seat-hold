import { readonly, ref } from "vue";

/**
 * A hash router is all a static demo needs: it works under any sub-path
 * (BASE_PATH) without server rewrites, and deep links survive a reload.
 */
export type Route = { name: "home" } | { name: "event"; slug: string } | { name: "tickets" };

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const event = /^event\/([\w-]+)/.exec(path);
  if (event) return { name: "event", slug: event[1] };
  if (path.startsWith("tickets")) return { name: "tickets" };
  return { name: "home" };
}

const current = ref<Route>(parse(typeof location === "undefined" ? "" : location.hash));

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    current.value = parse(location.hash);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  });
}

export const route = readonly(current);

export function href(to: Route): string {
  if (to.name === "event") return `#/event/${to.slug}`;
  if (to.name === "tickets") return "#/tickets";
  return "#/";
}

export function go(to: Route) {
  location.hash = href(to);
}
