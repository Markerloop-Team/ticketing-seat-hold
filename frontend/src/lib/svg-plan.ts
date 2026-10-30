export interface PlanShape {
  id: string;
  d: string;
}

export interface Plan {
  viewBox: string;
  shapes: PlanShape[];
  stage: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Pull section outlines out of the venue SVG instead of injecting it with v-html:
 * the markup comes from the admin, and we only need ids and path data.
 */
export function parsePlan(svg: string): Plan {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.querySelector("svg");
  const stage = doc.querySelector("rect.stage");
  const num = (el: Element, attr: string) => Number(el.getAttribute(attr) ?? 0);
  return {
    viewBox: root?.getAttribute("viewBox") ?? "0 0 100 100",
    shapes: [...doc.querySelectorAll("path[id]")].map((p) => ({
      id: p.id,
      d: p.getAttribute("d") ?? "",
    })),
    stage: stage
      ? {
          x: num(stage, "x"),
          y: num(stage, "y"),
          width: num(stage, "width"),
          height: num(stage, "height"),
        }
      : null,
  };
}
