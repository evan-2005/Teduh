/**
 * Ground positions for an area's candidates: every tree of each street-tree row, and the line
 * each covered walkway follows. Built once per area from its path network.
 */
import type { Intervention, Neighbourhood } from '../types';
import { anchorReach, walkwayStart } from './anchors';
import type { LatLngPair } from './localPlane';
import { coveredLengthM, shelterBuiltLengthM, treesInRow, type PlannerSettings } from './planner';
import { layoutTreeRow, layoutWalkway, type Obstacles, type PathObstacle, type RowSegment } from './rowLayout';
import { streetProfile } from './streetProfile';

const JUNCTION_DEGREE = 3;

export interface PlantingLayout {
  /** Exactly as many positions as the row's name and cost promise. */
  treePositions: (row: Intervention, planner: PlannerSettings, buildings: readonly LatLngPair[][]) => LatLngPair[];
  /** The walkway roof line, over the footpath, from its stop or entrance end. */
  walkwayLine: (shelter: Intervention, planner: PlannerSettings, buildings: readonly LatLngPair[][]) => LatLngPair[];
}

export function createPlantingLayout(
  neighbourhood: Pick<Neighbourhood, 'nodes' | 'segments' | 'destinations'>,
  lengthBySegment: ReadonlyMap<string, number>,
): PlantingLayout {
  const { nodes, segments, destinations } = neighbourhood;
  const coords = new Map(nodes.map((n) => [n.id, [n.lat, n.lng] as LatLngPair]));
  const byId = new Map(segments.map((s) => [s.id, s]));
  const degree = new Map<string, number>();
  segments.forEach((s) => [s.from, s.to].forEach((n) => degree.set(n, (degree.get(n) ?? 0) + 1)));
  const junctions = new Set([...degree].filter(([, d]) => d >= JUNCTION_DEGREE).map(([n]) => n));
  const anchors = anchorReach(segments, destinations, (id) => lengthBySegment.get(id) ?? 0);
  const paths: PathObstacle[] = segments.map((s) => ({
    a: coords.get(s.from)!,
    b: coords.get(s.to)!,
    clearanceM: streetProfile(s).clearanceM,
  }));
  const obstacles = (buildings: readonly LatLngPair[][]): Obstacles => ({ buildings, paths });

  const rowOf = (item: Intervention, offset: 'treeOffsetM' | 'walkwayOffsetM'): RowSegment[] =>
    item.segmentIds.flatMap((id) => {
      const s = byId.get(id);
      const a = s && coords.get(s.from);
      const b = s && coords.get(s.to);
      if (!s || !a || !b) return [];
      const profile = streetProfile(s);
      return [{ id, from: s.from, to: s.to, a, b, offsetM: profile[offset], kerbOffsetM: profile.kerbOffsetM }];
    });

  return {
    treePositions: (row, planner, buildings) => {
      const count = treesInRow(row, coveredLengthM(row, lengthBySegment), planner.treeSpacingM);
      return layoutTreeRow(rowOf(row, 'treeOffsetM'), count, junctions, obstacles(buildings));
    },
    walkwayLine: (shelter, planner, buildings) => {
      const builtM = shelterBuiltLengthM(coveredLengthM(shelter, lengthBySegment), planner);
      const first = byId.get(shelter.segmentIds[0] ?? '');
      const start = first && walkwayStart(first, anchors);
      return layoutWalkway(rowOf(shelter, 'walkwayOffsetM'), builtM, new Set(start ? [start] : []), obstacles(buildings));
    },
  };
}
