import { describe, expect, test } from 'vitest';
import { buildGraph } from '../lib/graph';
import { distanceToSegment, insidePolygon, localPlane, type LatLngPair } from '../lib/localPlane';
import { DEFAULT_PLANNER } from '../lib/planner';
import { createPlantingLayout } from '../lib/plantingLayout';
import { TREE_SPACING } from '../lib/planting';
import { streetProfile } from '../lib/streetProfile';
import { AREA_INDEX } from './areas';
import { loadContext } from './context';
import { loadDataset } from './load';

/** Placement checks on every shipped area: what the map draws is what the plan promises. */
const MIN_GAP_M = 4;
const MAX_GAP_M = TREE_SPACING.max + 1;
/** A few trees may have nowhere clear to go on a cramped corner; nearly all must be clear. */
const MIN_CLEAR_SHARE = 0.9;

const loaded = await Promise.all(
  AREA_INDEX.map(async (entry) => ({
    slug: entry.slug,
    data: await loadDataset(entry.slug),
    buildings: ((await loadContext(entry.slug))?.buildings ?? []) as LatLngPair[][],
  })),
);

describe.each(loaded)('placements in $slug', ({ data, buildings }) => {
  const { neighbourhood, interventions } = data;
  const graph = buildGraph(neighbourhood.nodes, neighbourhood.segments);
  const layout = createPlantingLayout(neighbourhood, graph.lengthBySegment);
  const rows = interventions.filter((i) => i.type === 'tree');
  const plane = localPlane([neighbourhood.nodes[0]!.lat, neighbourhood.nodes[0]!.lng]);
  const coords = new Map(neighbourhood.nodes.map((n) => [n.id, plane.toPoint([n.lat, n.lng])]));
  const rings = buildings.map((ring) => ring.map(plane.toPoint));
  const isClear = (p: LatLngPair): boolean => {
    const point = plane.toPoint(p);
    if (rings.some((ring) => insidePolygon(point, ring))) return false;
    return neighbourhood.segments.every(
      (s) => distanceToSegment(point, coords.get(s.from)!, coords.get(s.to)!) >= streetProfile(s).clearanceM - 0.01,
    );
  };

  test('every row draws exactly the trees its name promises, at street-tree spacing', () => {
    for (const row of rows) {
      const trees = layout.treePositions(row, DEFAULT_PLANNER, buildings);
      expect(trees.length, row.name).toBe(Number(/\((\d+) trees\)/.exec(row.name)![1]));
      const points = trees.map(plane.toPoint);
      const gaps = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
      const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]!;
      expect(Math.min(...gaps), row.name).toBeGreaterThanOrEqual(MIN_GAP_M);
      expect(median, row.name).toBeGreaterThanOrEqual(TREE_SPACING.min - 1);
      expect(median, row.name).toBeLessThanOrEqual(MAX_GAP_M);
    }
  });

  test('trees stand clear of buildings and of every road and path', () => {
    const all = rows.flatMap((row) => layout.treePositions(row, DEFAULT_PLANNER, buildings));
    const clear = all.filter(isClear).length;
    expect(clear / all.length).toBeGreaterThanOrEqual(MIN_CLEAR_SHARE);
  });

  test('a walkway covers its built length and no more', () => {
    for (const shelter of interventions.filter((i) => i.type === 'shelter')) {
      const line = layout.walkwayLine(shelter, { ...DEFAULT_PLANNER, maxShelterM: 30 }, buildings).map(plane.toPoint);
      const lengthM = line.reduce((sum, p, i) => (i % 2 ? sum + Math.hypot(p.x - line[i - 1]!.x, p.y - line[i - 1]!.y) : sum), 0);
      expect(lengthM, shelter.name).toBeLessThanOrEqual(30 + 0.5);
    }
  });
});
