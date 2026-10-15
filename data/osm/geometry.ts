/** Small planar geometry helpers. Coordinates are local metres (x east, y north). */

export type XY = readonly [number, number];

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Equirectangular projection around a centre: accurate to centimetres over a few hundred metres. */
export interface Projection {
  toXY: (lat: number, lng: number) => XY;
  toLatLng: (x: number, y: number) => [number, number];
}

export function createProjection(lat0: number, lng0: number): Projection {
  const cosLat = Math.cos(toRad(lat0));
  return {
    toXY: (lat, lng) => [
      toRad(lng - lng0) * EARTH_RADIUS_M * cosLat,
      toRad(lat - lat0) * EARTH_RADIUS_M,
    ],
    toLatLng: (x, y) => [
      lat0 + toDeg(y / EARTH_RADIUS_M),
      lng0 + toDeg(x / (EARTH_RADIUS_M * cosLat)),
    ],
  };
}

export const distance = (a: XY, b: XY): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

export const polylineLength = (points: readonly XY[]): number =>
  points.slice(1).reduce((sum, p, i) => sum + distance(points[i]!, p), 0);

function pointToSegment(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq));
  return distance(p, [a[0] + t * dx, a[1] + t * dy]);
}

/** Douglas-Peucker: drop points that lie within `tolerance` metres of the straight line. */
export function simplify(points: readonly XY[], tolerance: number): XY[] {
  if (points.length <= 2) return [...points];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let worst = -1;
  let worstDistance = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegment(points[i]!, first, last);
    if (d > worstDistance) {
      worstDistance = d;
      worst = i;
    }
  }
  if (worstDistance <= tolerance) return [first, last];
  const left = simplify(points.slice(0, worst + 1), tolerance);
  const right = simplify(points.slice(worst), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Insert evenly spaced points so no piece is longer than `maxLength`. */
export function splitEvenly(a: XY, b: XY, maxLength: number): XY[] {
  const pieces = Math.max(1, Math.ceil(distance(a, b) / maxLength));
  return Array.from({ length: pieces + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / pieces,
    a[1] + ((b[1] - a[1]) * i) / pieces,
  ]);
}

export const centroid = (points: readonly XY[]): XY => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
];

/** Point `distanceAlong` metres from the start of a polyline (clamped to the ends). */
export function pointAlong(points: readonly XY[], distanceAlong: number): XY {
  let remaining = distanceAlong;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = distance(a, b);
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    remaining -= length;
  }
  return points[points.length - 1]!;
}

/**
 * Distance along the ray from `origin` in direction `dir` (unit vector) to the first polygon edge
 * it crosses, or null if it does not cross within `maxDistance`.
 */
export function rayPolygonHit(
  origin: XY,
  dir: XY,
  ring: readonly XY[],
  maxDistance: number,
): number | null {
  let nearest: number | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const denominator = dir[0] * ey - dir[1] * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const ox = a[0] - origin[0];
    const oy = a[1] - origin[1];
    const t = (ox * ey - oy * ex) / denominator;
    const u = (ox * dir[1] - oy * dir[0]) / denominator;
    if (t >= 0 && t <= maxDistance && u >= 0 && u <= 1 && (nearest === null || t < nearest)) {
      nearest = t;
    }
  }
  return nearest;
}

export function pointInPolygon(p: XY, ring: readonly XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}
