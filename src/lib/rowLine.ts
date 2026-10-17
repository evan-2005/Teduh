/**
 * The line a row of street trees stands on: parallel to its path at the footpath edge, mitred
 * at bends, and the evenly spaced points along it where each tree goes. Spacing is measured on
 * this line, not on the path centreline, so trees on the inside of a corner do not bunch up.
 */
import { TREE_SPACING } from './planting';
import { add, type Point } from './localPlane';

/** One path segment of the run, oriented along it, in local metres. */
export interface Leg {
  from: string;
  to: string;
  a: Point;
  b: Point;
  len: number;
  offsetM: number;
  /** Fallback offset: a kerb build-out just off the carriageway, where the verge is built up. */
  kerbOffsetM: number;
  dir: Point;
  normal: Point;
}

/** The part of the tree line beside one leg. */
export interface Stretch { fromNode: string; toNode: string; a: Point; b: Point; len: number }
/** A position on the tree line: `t` metres along a stretch. */
export interface LinePoint { stretch: Stretch; t: number }

/** Sharper turns than this are bevelled, so the mitre point does not shoot off the corner. */
const BEVEL_TURN_RAD = (2 * Math.PI) / 3;
const PARALLEL_EPSILON = 1e-6;
/** A mitre point farther than this many offsets from the corner is replaced by a bevel. */
const MITRE_LIMIT = 2;

const sub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
const dot = (u: Point, v: Point): number => u.x * v.x + u.y * v.y;
const cross = (u: Point, v: Point): number => u.x * v.y - u.y * v.x;

/**
 * Where the offset lines of two linked legs cross, as distances along each (a mitre), or null
 * where they should simply butt up: nearly parallel, a very sharp turn, or a far-off crossing
 * between paths of different widths.
 */
function mitre(before: Leg, after: Leg, origin: (leg: Leg) => Point): [number, number] | null {
  const c = cross(before.dir, after.dir);
  const turn = Math.acos(Math.max(-1, Math.min(1, dot(before.dir, after.dir))));
  if (Math.abs(c) < PARALLEL_EPSILON || turn > BEVEL_TURN_RAD) return null;
  const gap = sub(origin(after), origin(before));
  const along = cross(gap, after.dir) / c;
  const limit = MITRE_LIMIT * Math.max(before.offsetM, after.offsetM, before.kerbOffsetM, after.kerbOffsetM);
  return Math.abs(along - before.len) > limit ? null : [along, cross(gap, before.dir) / c];
}

/**
 * The tree line on one side of a run (+1 = left of the direction of travel). Each stretch runs
 * exactly parallel to its leg at the leg's offset; at a bend the stretches are cut where they
 * cross, so on the inside of a corner they are shorter and trees do not crowd together.
 */
export function treeLine(legs: readonly Leg[], side: number, atKerb = false): Stretch[] {
  const origin = (leg: Leg): Point => add(leg.a, leg.normal, side * (atKerb ? leg.kerbOffsetM : leg.offsetM));
  const meets = legs.map((leg, i) => {
    const next = legs[i + 1];
    return next && next.from === leg.to ? mitre(leg, next, origin) : null;
  });
  return legs.map((leg, i) => {
    const start = meets[i - 1]?.[1] ?? 0;
    const end = meets[i]?.[0] ?? leg.len;
    const a = add(origin(leg), leg.dir, start);
    return { fromNode: leg.from, toNode: leg.to, a, b: add(origin(leg), leg.dir, end), len: Math.max(0, end - start) };
  });
}

/**
 * `count` evenly spaced points along the tree line, kept `clearM` back from junctions. The
 * clearances shrink evenly when keeping them all would squeeze the row below the minimum spacing.
 */
export function spacedPoints(
  stretches: readonly Stretch[],
  count: number,
  junctions: ReadonlySet<string>,
  clearM: number,
): LinePoint[] {
  const clear = (node: string): number => (junctions.has(node) ? clearM : 0);
  const raw = stretches.reduce((sum, s) => sum + s.len, 0);
  const trims = stretches.reduce((sum, s) => sum + Math.min(s.len, clear(s.fromNode) + clear(s.toNode)), 0);
  const scale = trims > 0 ? Math.max(0, Math.min(1, (raw - count * TREE_SPACING.min) / trims)) : 1;
  const spans = stretches.map((s) => {
    const start = Math.min(s.len, clear(s.fromNode) * scale);
    return { stretch: s, start, end: Math.max(start, s.len - clear(s.toNode) * scale) };
  });
  const spacing = spans.reduce((sum, s) => sum + s.end - s.start, 0) / count;
  return Array.from({ length: count }, (_, i) => {
    let d = (i + 0.5) * spacing;
    for (const span of spans) {
      const usable = span.end - span.start;
      if (d <= usable || span === spans.at(-1)) return { stretch: span.stretch, t: span.start + Math.min(d, usable) };
      d -= usable;
    }
    return { stretch: stretches[0]!, t: 0 };
  });
}

/** The ground position of a line point, optionally moved along its stretch. */
export function pointOn({ stretch, t }: LinePoint, shiftM = 0): Point {
  if (stretch.len <= 0) return stretch.a;
  const f = Math.max(0, Math.min(stretch.len, t + shiftM)) / stretch.len;
  return { x: stretch.a.x + (stretch.b.x - stretch.a.x) * f, y: stretch.a.y + (stretch.b.y - stretch.a.y) * f };
}
