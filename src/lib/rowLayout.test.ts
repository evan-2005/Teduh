import { describe, expect, test } from 'vitest';
import { distanceToSegment, localPlane, type LatLngPair } from './localPlane';
import { chainRow, JUNCTION_CLEAR_M, layoutTreeRow, layoutWalkway, type Obstacles, type RowSegment } from './rowLayout';

const ORIGIN: LatLngPair = [3.07, 101.58];
const plane = localPlane(ORIGIN);
const at = (x: number, y: number): LatLngPair => plane.toLatLng({ x, y });
const NONE: Obstacles = { buildings: [], paths: [] };
const OFFSET_M = 4.3;

/** A straight east-west street from x = 0 to x = 104 m, in two segments. */
const street: RowSegment[] = [
  { id: 's1', from: 'n0', to: 'n1', a: at(0, 0), b: at(60, 0), offsetM: OFFSET_M },
  { id: 's2', from: 'n2', to: 'n1', a: at(104, 0), b: at(60, 0), offsetM: OFFSET_M },
];
const xy = (p: LatLngPair) => plane.toPoint(p);
const gaps = (points: LatLngPair[]) =>
  points.slice(1).map((p, i) => Math.hypot(xy(p).x - xy(points[i]!).x, xy(p).y - xy(points[i]!).y));

describe('chainRow', () => {
  test('orients segments into one run from an end', () => {
    const chain = chainRow(street);
    expect(chain.map((s) => [s.from, s.to])).toEqual([['n0', 'n1'], ['n1', 'n2']]);
  });

  test('starts at a preferred end', () => {
    expect(chainRow(street, new Set(['n2']))[0]!.from).toBe('n2');
  });
});

describe('layoutTreeRow', () => {
  test('draws exactly the promised number of trees, evenly spaced', () => {
    const trees = layoutTreeRow(street, 13, new Set(), NONE);
    expect(trees).toHaveLength(13);
    gaps(trees).forEach((gap) => expect(gap).toBeCloseTo(8, 1));
  });

  test('trees stand on the footpath edge, not on the street centreline', () => {
    layoutTreeRow(street, 13, new Set(), NONE).forEach((p) => expect(Math.abs(xy(p).y)).toBeCloseTo(OFFSET_M, 1));
  });

  test('keeps the row on the side without buildings', () => {
    const block = [at(-5, 2), at(110, 2), at(110, 20), at(-5, 20), at(-5, 2)];
    const trees = layoutTreeRow(street, 13, new Set(), { buildings: [block], paths: [] });
    trees.forEach((p) => expect(xy(p).y).toBeLessThan(0));
  });

  test('stays back from junctions at both ends', () => {
    const trees = layoutTreeRow(street, 10, new Set(['n0', 'n2']), NONE);
    const xs = trees.map((p) => xy(p).x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(JUNCTION_CLEAR_M);
    expect(Math.max(...xs)).toBeLessThanOrEqual(104 - JUNCTION_CLEAR_M);
  });

  test('moves trees off a crossing path', () => {
    const crossing = { a: at(52, -30), b: at(52, 30), clearanceM: 3.5 };
    const trees = layoutTreeRow(street, 13, new Set(), { buildings: [], paths: [crossing] });
    expect(trees).toHaveLength(13);
    trees.forEach((p) => expect(distanceToSegment(xy(p), xy(crossing.a), xy(crossing.b))).toBeGreaterThanOrEqual(3.5));
  });

  test('trees round a corner without bunching on the inside of the bend', () => {
    const corner: RowSegment[] = [
      { id: 'c1', from: 'k0', to: 'k1', a: at(0, 0), b: at(48, 0), offsetM: OFFSET_M },
      { id: 'c2', from: 'k1', to: 'k2', a: at(48, 0), b: at(48, 48), offsetM: OFFSET_M },
    ];
    // Buildings fill the outside of the bend, so the row must take the inside.
    const south = [at(-5, -2), at(60, -2), at(60, -10), at(-5, -10), at(-5, -2)];
    const east = [at(50, -10), at(60, -10), at(60, 60), at(50, 60), at(50, -10)];
    const trees = layoutTreeRow(corner, 12, new Set(), { buildings: [south, east], paths: [] });
    trees.forEach((p) => expect(xy(p).x).toBeLessThan(48));
    expect(trees).toHaveLength(12);
    expect(Math.min(...gaps(trees))).toBeGreaterThanOrEqual(4);
  });

  test('returns nothing for an empty row', () => {
    expect(layoutTreeRow([], 5, new Set(), NONE)).toEqual([]);
  });
});

describe('layoutWalkway', () => {
  test('covers only the built length, starting at the anchor', () => {
    const line = layoutWalkway(street, 30, new Set(['n2']), NONE);
    const xs = line.map((p) => xy(p).x);
    expect(Math.max(...xs)).toBeCloseTo(104, 0);
    expect(Math.min(...xs)).toBeCloseTo(74, 0);
  });

  test('runs over the whole stretch when the walkway is long enough', () => {
    const line = layoutWalkway(street, 200, new Set(), NONE);
    const xs = line.map((p) => xy(p).x);
    expect(Math.min(...xs)).toBeCloseTo(0, 0);
    expect(Math.max(...xs)).toBeCloseTo(104, 0);
  });
});
