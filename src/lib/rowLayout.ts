/**
 * Where each street tree of a row, and each covered walkway, sits on the ground.
 *
 * Trees stand on the footpath edge beside their path (the offset comes from the street profile),
 * evenly spaced along the row, kept back from junctions, and never inside a building or on
 * another path's carriageway. The row keeps to one side of its street where it can.
 */
import { pointOn, spacedPoints, treeLine, type Leg, type LinePoint } from './rowLine';
import {
  add,
  distanceToSegment,
  frame,
  insidePolygon,
  length,
  localPlane,
  type LatLngPair,
  type LocalPlane,
  type Point,
} from './localPlane';

export interface RowSegment {
  id: string;
  from: string;
  to: string;
  a: LatLngPair;
  b: LatLngPair;
  /** Distance from the centreline to where the trees (or the walkway) go. */
  offsetM: number;
  /** Where a tree goes if the footpath edge is built up: a kerb build-out. Defaults to `offsetM`. */
  kerbOffsetM?: number;
}

export interface PathObstacle { a: LatLngPair; b: LatLngPair; clearanceM: number }
export interface Obstacles {
  buildings: readonly (readonly LatLngPair[])[];
  paths: readonly PathObstacle[];
}

/** Keep trees back from junctions, so they stay clear of crossings and sight lines. */
export const JUNCTION_CLEAR_M = 6;
const OBSTACLE_MARGIN_M = 25;
/** If a tree's spot is blocked, nudge it along the row (in spacings), then try the other side. */
const SHIFT_FRACTIONS = [0, 1 / 4, -1 / 4, 1 / 2, -1 / 2, 3 / 4, -3 / 4] as const;
/** Two trees of a row never stand closer than this. */
const MIN_TREE_GAP_M = 4;
const WALKWAY_SAMPLE_M = 5;

type IsBlocked = (p: Point) => boolean;

/** Orient the segments into one connected run, starting at a preferred end when there is one. */
export function chainRow(segments: readonly RowSegment[], preferStart: ReadonlySet<string> = new Set()): RowSegment[] {
  const degree = new Map<string, number>();
  segments.forEach((s) => [s.from, s.to].forEach((n) => degree.set(n, (degree.get(n) ?? 0) + 1)));
  const ends = [...degree].filter(([, d]) => d === 1).map(([n]) => n);
  let node = ends.find((n) => preferStart.has(n)) ?? ends[0] ?? segments[0]?.from;
  const left = [...segments];
  const chain: RowSegment[] = [];
  while (left.length > 0) {
    const index = left.findIndex((s) => s.from === node || s.to === node);
    const [next] = left.splice(Math.max(0, index), 1);
    const oriented = index < 0 || next!.from === node ? next! : { ...next!, from: next!.to, to: next!.from, a: next!.b, b: next!.a };
    chain.push(oriented);
    node = oriented.to;
  }
  return chain;
}

function toLegs(chain: readonly RowSegment[], plane: LocalPlane): Leg[] {
  return chain.map((s) => {
    const a = plane.toPoint(s.a);
    const b = plane.toPoint(s.b);
    const kerbOffsetM = s.kerbOffsetM ?? s.offsetM;
    return { from: s.from, to: s.to, a, b, len: length(a, b), offsetM: s.offsetM, kerbOffsetM, ...frame(a, b) };
  });
}

const pointAt = (leg: Leg, t: number, side: number): Point =>
  add(add(leg.a, leg.dir, Math.max(0, Math.min(leg.len, t))), leg.normal, side * leg.offsetM);

interface Box { minX: number; minY: number; maxX: number; maxY: number }

const boxOf = (points: readonly Point[], margin: number): Box => ({
  minX: Math.min(...points.map((p) => p.x)) - margin,
  minY: Math.min(...points.map((p) => p.y)) - margin,
  maxX: Math.max(...points.map((p) => p.x)) + margin,
  maxY: Math.max(...points.map((p) => p.y)) + margin,
});

const overlaps = (a: Box, b: Box): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/** A test for "is this spot inside a building or on another path?", limited to the run's area. */
function blocker(legs: readonly Leg[], plane: LocalPlane, obstacles: Obstacles): IsBlocked {
  const area = boxOf(legs.flatMap((l) => [l.a, l.b]), OBSTACLE_MARGIN_M);
  const near = (points: readonly Point[]) => overlaps(boxOf(points, 0), area);
  const buildings = obstacles.buildings.map((ring) => ring.map(plane.toPoint)).filter(near);
  const paths = obstacles.paths
    .map((p) => ({ a: plane.toPoint(p.a), b: plane.toPoint(p.b), clearanceM: p.clearanceM }))
    .filter((p) => near([p.a, p.b]));
  return (p) =>
    buildings.some((ring) => insidePolygon(p, ring)) ||
    paths.some((path) => distanceToSegment(p, path.a, path.b) < path.clearanceM);
}

/** The side (+1 left, -1 right of the run) with fewer blocked spots. */
const preferredSide = (points: (side: number) => Point[], isBlocked: IsBlocked): number =>
  points(-1).filter(isBlocked).length < points(1).filter(isBlocked).length ? -1 : 1;

/** Positions for exactly `count` trees along a row. */
export function layoutTreeRow(
  segments: readonly RowSegment[],
  count: number,
  junctions: ReadonlySet<string>,
  obstacles: Obstacles,
): LatLngPair[] {
  if (segments.length === 0 || count <= 0) return [];
  const plane = localPlane(segments[0]!.a);
  const legs = toLegs(chainRow(segments), plane);
  const isBlocked = blocker(legs, plane, obstacles);
  const line = (side: number, atKerb: boolean) =>
    spacedPoints(treeLine(legs, side, atKerb), count, junctions, JUNCTION_CLEAR_M);
  const blockedOn = (points: LinePoint[]) => points.filter((p) => isBlocked(pointOn(p))).length;
  const side = blockedOn(line(-1, false)) < blockedOn(line(1, false)) ? -1 : 1;
  // Footpath edge on the better side, then the other side, then kerb build-outs on each.
  const lines = [line(side, false), line(-side, false), line(side, true), line(-side, true)];
  const spacing = legs.reduce((sum, l) => sum + l.len, 0) / count;
  const placed: Point[] = [];
  const crowded = (p: Point) => placed.some((q) => length(p, q) < MIN_TREE_GAP_M);
  lines[0]!.forEach((_, i) => {
    const options = lines.flatMap((l) => SHIFT_FRACTIONS.map((f) => pointOn(l[i]!, f * spacing)));
    placed.push(options.find((p) => !isBlocked(p) && !crowded(p)) ?? options.find((p) => !crowded(p)) ?? options[0]!);
  });
  return placed.map(plane.toLatLng);
}

/** The line a covered walkway follows: `builtM` metres of the run from its anchor end. */
export function layoutWalkway(
  segments: readonly RowSegment[],
  builtM: number,
  anchors: ReadonlySet<string>,
  obstacles: Obstacles,
): LatLngPair[] {
  if (segments.length === 0) return [];
  const plane = localPlane(segments[0]!.a);
  const legs = toLegs(chainRow(segments, anchors), plane);
  const covered: { leg: Leg; end: number }[] = [];
  let remaining = builtM;
  for (const leg of legs) {
    if (remaining <= 0) break;
    covered.push({ leg, end: Math.min(leg.len, remaining) });
    remaining -= leg.len;
  }
  const samples = (s: number) =>
    covered.flatMap(({ leg, end }) =>
      Array.from({ length: Math.ceil(end / WALKWAY_SAMPLE_M) + 1 }, (_, i) => pointAt(leg, i * WALKWAY_SAMPLE_M, s)),
    );
  const side = preferredSide(samples, blocker(legs, plane, obstacles));
  return covered.flatMap(({ leg, end }) => [pointAt(leg, 0, side), pointAt(leg, end, side)]).map(plane.toLatLng);
}
