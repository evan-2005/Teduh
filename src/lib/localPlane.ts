/** Small flat-earth helpers for laying things out within a neighbourhood, in metres. */

export type LatLngPair = [number, number];
export type Point = { x: number; y: number };

const METRES_PER_DEGREE = 111_320;
const DEG_TO_RAD = Math.PI / 180;

export interface LocalPlane {
  toPoint: (p: LatLngPair) => Point;
  toLatLng: (p: Point) => LatLngPair;
}

/** Equirectangular projection around an origin: accurate to centimetres over a few hundred metres. */
export function localPlane(origin: LatLngPair): LocalPlane {
  const xScale = METRES_PER_DEGREE * Math.cos(origin[0] * DEG_TO_RAD);
  return {
    toPoint: ([lat, lng]) => ({ x: (lng - origin[1]) * xScale, y: (lat - origin[0]) * METRES_PER_DEGREE }),
    toLatLng: ({ x, y }) => [origin[0] + y / METRES_PER_DEGREE, origin[1] + x / xScale],
  };
}

export const add = (p: Point, q: Point, k = 1): Point => ({ x: p.x + q.x * k, y: p.y + q.y * k });
export const length = (p: Point, q: Point): number => Math.hypot(q.x - p.x, q.y - p.y);

/** Unit direction from a to b, and its left-hand normal. */
export function frame(a: Point, b: Point): { dir: Point; normal: Point } {
  const len = length(a, b) || 1;
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  return { dir, normal: { x: -dir.y, y: dir.x } };
}

/** Shortest distance from p to the segment a-b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ray-casting point-in-polygon test. */
export function insidePolygon(p: Point, ring: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}
