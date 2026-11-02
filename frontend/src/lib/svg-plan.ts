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

/** Rough visual centre of a path: the middle of its end points' bounding box. */
export function pathCentre(d: string): { x: number; y: number } {
  const points: Array<[number, number]> = [];
  for (const [, cmd, args] of d.matchAll(/([MLA])([^MLAZz]*)/gi)) {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    // Arc commands carry radii and flags first; the end point is the last pair.
    const pairs = cmd.toUpperCase() === "A" ? [nums.slice(-2)] : chunk(nums);
    for (const [x, y] of pairs) if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
  }
  if (!points.length) return { x: 0, y: 0 };
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function chunk(nums: number[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}
