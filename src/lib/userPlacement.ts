/**
 * Tree rows and covered walkways a person places themselves, by picking the paths they run along.
 * They are priced from the same bill of materials and shaded by the same rules as the generated
 * candidates, so they compete fairly in the optimiser.
 */
import { generateShelterSpec, generateTreeSpec } from '../features/fabrication/spec';
import type { Feasibility, Intervention, InterventionType, PathSegment, UnitCosts } from '../types';
import {
  SHELTER_SHADE,
  shelterPlanningCost,
  TREE_SHADE_FUTURE,
  TREE_SHADE_NOW,
  TREE_YEARS_TO_MATURE,
  treeCount,
  treePlanningCost,
} from './planting';
import { pathKind } from './streetProfile';

export const USER_ID_PREFIX = 'user-';
const BUSY_KINDS = new Set(['main road', 'collector road']);

export interface PlacementContext {
  segmentsById: ReadonlyMap<string, PathSegment>;
  lengthBySegment: ReadonlyMap<string, number>;
  unitCosts: UnitCosts;
}

export const isUserPlaced = (id: string): boolean => id.startsWith(USER_ID_PREFIX);

/**
 * Add a path to the run being picked, or take it out again. A path that does not touch the run
 * starts a new run, so a row or walkway is always one connected stretch.
 */
export function togglePath(selected: readonly string[], id: string, segmentsById: ReadonlyMap<string, PathSegment>): string[] {
  if (selected.includes(id)) return largestRun(selected.filter((s) => s !== id), segmentsById);
  const segment = segmentsById.get(id);
  if (!segment) return [...selected];
  const nodes = new Set(selected.flatMap((s) => [segmentsById.get(s)?.from, segmentsById.get(s)?.to]));
  return nodes.has(segment.from) || nodes.has(segment.to) ? [...selected, id] : [id];
}

/**
 * Taking a path out of the middle of a run splits it in two. Keep the bigger piece (the earlier
 * picked one on a tie), in pick order, so the run stays one connected stretch.
 */
function largestRun(ids: readonly string[], segmentsById: ReadonlyMap<string, PathSegment>): string[] {
  const ends = (id: string) => [segmentsById.get(id)?.from, segmentsById.get(id)?.to];
  const touches = (a: string, b: string) => ends(a).some((n) => n !== undefined && ends(b).includes(n));
  let best: readonly string[] = [];
  const seen = new Set<string>();
  for (const start of ids) {
    if (seen.has(start)) continue;
    const run = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift()!;
      ids.filter((other) => !run.has(other) && touches(current, other)).forEach((other) => {
        run.add(other);
        queue.push(other);
      });
    }
    run.forEach((r) => seen.add(r));
    if (run.size > best.length) best = ids.filter((r) => run.has(r));
  }
  return [...best];
}

/** The street most of the picked paths are on ("SS 15/8A Road"), or their kind ("footpath"). */
export function streetOf(segmentIds: readonly string[], segmentsById: ReadonlyMap<string, PathSegment>): string {
  const names = segmentIds.map((id) => {
    const notes = segmentsById.get(id)?.notes ?? '';
    return notes.includes(':') ? notes.split(':')[1]!.replace(/\(covered\)/, '').trim() : `a ${pathKind({ notes }) || 'path'}`;
  });
  const counts = new Map<string, number>();
  names.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'a path';
}

const feasibilityOf = (segmentIds: readonly string[], ctx: PlacementContext): Feasibility =>
  segmentIds.some((id) => BUSY_KINDS.has(pathKind(ctx.segmentsById.get(id) ?? {}))) ? 'needs-check' : 'likely';

/** A tree row or covered walkway along the picked paths, priced and shaded like the others. */
export function createUserIntervention(
  type: InterventionType,
  segmentIds: readonly string[],
  index: number,
  ctx: PlacementContext,
): Intervention {
  const lengthM = segmentIds.reduce((sum, id) => sum + (ctx.lengthBySegment.get(id) ?? 0), 0);
  const street = streetOf(segmentIds, ctx.segmentsById);
  const draft: Intervention = {
    id: `${USER_ID_PREFIX}${type}-${index}`,
    type,
    name: '',
    segmentIds: [...segmentIds],
    installCost: 0,
    annualMaintenance: 0,
    shadeNow: type === 'tree' ? TREE_SHADE_NOW : SHELTER_SHADE,
    shadeFuture: type === 'tree' ? TREE_SHADE_FUTURE : SHELTER_SHADE,
    yearsToMature: type === 'tree' ? TREE_YEARS_TO_MATURE : 0,
    feasibility: feasibilityOf(segmentIds, ctx),
    costSource: 'estimated',
  };
  if (type === 'tree') {
    const count = treeCount(lengthM);
    const spec = generateTreeSpec(draft, ctx.unitCosts, lengthM);
    return { ...draft, name: `Your trees on ${street} (${count} ${count === 1 ? 'tree' : 'trees'})`, ...treePlanningCost(spec, ctx.unitCosts) };
  }
  const segments = segmentIds.flatMap((id) => ctx.segmentsById.get(id) ?? []);
  const spec = generateShelterSpec(draft, segments, ctx.unitCosts, ctx.lengthBySegment);
  return { ...draft, name: `Your covered walkway on ${street} (${Math.round(lengthM)} m)`, ...shelterPlanningCost(spec) };
}
