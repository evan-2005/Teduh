/**
 * Generate candidate shelters and street-tree rows where exposed paths carry the most trips.
 * Costs come from the same bottom-up bill of materials the Fabrication panel shows, so the
 * simulator and the build pack agree.
 */
import { DEFAULT_DETOUR, EXPOSED_THRESHOLD } from '../../src/config';
import { generateShelterSpec, generateTreeSpec } from '../../src/features/fabrication/spec';
import type { Graph } from '../../src/lib/graph';
import { leastSunRoute } from '../../src/lib/routing';
import { buildShadeLookup } from '../../src/lib/shade';
import type {
  Destination,
  Feasibility,
  Intervention,
  Journey,
  PathSegment,
  UnitCosts,
} from '../../src/types';

const SHELTER_COUNT = 3;
const TREE_COUNT = 5;
const MAX_TREE_ROWS_PER_STREET = 2;
const MAX_SHELTER_M = 100;
const SHARED_CORRIDOR_RATIO = 0.5;
const SHELTER_SHADE = 0.95;
const TREE_SHADE_NOW = 0.2;
const TREE_SHADE_FUTURE = 0.75;
const TREE_YEARS_TO_MATURE = 6;
const SHELTER_COST_STEP = 1000;
const TREE_COST_STEP = 100;
const SHELTER_UPKEEP_RATE = 0.025;
const UPKEEP_STEP = 10;
const BUSY_ROADS = new Set(['secondary', 'tertiary', 'primary']);

export interface SegmentInfo { name?: string; highway: string }

export const HIGHWAY_LABELS: Readonly<Record<string, string>> = {
  footway: 'footpath', path: 'path', steps: 'steps', cycleway: 'cycle path', track: 'track',
  pedestrian: 'pedestrian street', service: 'service lane', residential: 'residential street',
  living_street: 'residential street', unclassified: 'local road', tertiary: 'collector road',
  secondary: 'main road', primary: 'main road',
};

interface Context {
  segments: readonly PathSegment[];
  graph: Graph;
  journeys: readonly Journey[];
  destinations: readonly Destination[];
  info: ReadonlyMap<string, SegmentInfo>;
  unitCosts: UnitCosts;
  /** Which part of the area a set of segments sits in, e.g. "north-east". */
  sideOf: (segmentIds: readonly string[]) => string;
}

const COMPASS_ABBREVIATIONS: Readonly<Record<string, string>> = {
  north: 'N', 'north-east': 'NE', east: 'E', 'south-east': 'SE',
  south: 'S', 'south-west': 'SW', west: 'W', 'north-west': 'NW',
};
const abbreviate = (side: string): string => COMPASS_ABBREVIATIONS[side] ?? side;

const roundTo = (value: number, step: number): number => Math.max(step, Math.round(value / step) * step);

function usageBySegment(ctx: Context): Map<string, number> {
  const shade = buildShadeLookup(ctx.segments, {
    time: '14:00', canopy: 'now', canopyYear: 0, interventions: [], overrides: [],
  });
  const nodeOf = new Map(ctx.destinations.map((d) => [d.id, d.nodeId]));
  const usage = new Map<string, number>();
  for (const journey of ctx.journeys) {
    const from = nodeOf.get(journey.originId);
    const to = nodeOf.get(journey.destinationId);
    const route = from && to ? leastSunRoute(ctx.graph, from, to, shade, DEFAULT_DETOUR) : null;
    for (const id of route?.segmentIds ?? []) usage.set(id, (usage.get(id) ?? 0) + journey.dailyTrips);
  }
  return usage;
}

const commonName = (ids: readonly string[], info: ReadonlyMap<string, SegmentInfo>): string | undefined => {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const name = info.get(id)?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const feasibilityOf = (ids: readonly string[], info: ReadonlyMap<string, SegmentInfo>): Feasibility =>
  ids.some((id) => BUSY_ROADS.has(info.get(id)?.highway ?? '')) ? 'needs-check' : 'likely';

export function generateCandidates(ctx: Context): Intervention[] {
  const usage = usageBySegment(ctx);
  const lengthOf = (id: string): number => ctx.graph.lengthBySegment.get(id) ?? 0;
  const shade14 = (s: PathSegment): number => s.shade['14:00'];
  const exposed = ctx.segments.filter((s) => s.accessible && shade14(s) < EXPOSED_THRESHOLD);
  const used = new Set<string>();
  const score = (s: PathSegment): number => (usage.get(s.id) ?? 0) * lengthOf(s.id) * (1 - shade14(s));
  const free = (): PathSegment[] => exposed.filter((s) => !used.has(s.id) && score(s) > 0);

  const result: Intervention[] = [];

  // A shelter may not touch an earlier one: otherwise the next "candidate" is just the
  // neighbouring stretch of the same corridor, serving the same trips (an interchangeable twin).
  const shelterNodes = new Set<string>();
  const freeForShelter = (): PathSegment[] =>
    free().filter((s) => !shelterNodes.has(s.from) && !shelterNodes.has(s.to));

  for (let k = 1; k <= SHELTER_COUNT; k++) {
    const seed = freeForShelter().sort((a, b) => score(b) - score(a))[0];
    if (!seed) break;
    const window = growWindow(seed, freeForShelter(), usage, lengthOf);
    window.forEach((s) => {
      used.add(s.id);
      shelterNodes.add(s.from);
      shelterNodes.add(s.to);
    });
    result.push(shelterFor(k, window, ctx));
  }

  const perStreet = new Map<string, number>();
  const treeSegments = free()
    .sort((a, b) => score(b) - score(a))
    .filter((s) => {
      const street = ctx.info.get(s.id)?.name ?? s.id;
      const count = perStreet.get(street) ?? 0;
      perStreet.set(street, count + 1);
      return count < MAX_TREE_ROWS_PER_STREET;
    })
    .slice(0, TREE_COUNT);
  treeSegments.forEach((segment, index) => result.push(treesFor(index + 1, segment, ctx)));
  return uniqueNames(result);
}

/** Two candidates can share a street and side; tell them apart with A, B, C. */
export function uniqueNames(items: readonly Intervention[]): Intervention[] {
  const totals = new Map<string, number>();
  items.forEach((i) => totals.set(i.name, (totals.get(i.name) ?? 0) + 1));
  const seen = new Map<string, number>();
  return items.map((i) => {
    if ((totals.get(i.name) ?? 0) < 2) return i;
    const index = seen.get(i.name) ?? 0;
    seen.set(i.name, index + 1);
    return { ...i, name: `${i.name} – ${String.fromCharCode(65 + index)}` };
  });
}

/** Extend a seed segment along neighbouring busy exposed segments (a shared corridor). */
function growWindow(
  seed: PathSegment,
  pool: readonly PathSegment[],
  usage: ReadonlyMap<string, number>,
  lengthOf: (id: string) => number,
): PathSegment[] {
  const window = [seed];
  let ends = [seed.from, seed.to];
  let total = lengthOf(seed.id);
  const seedUsage = usage.get(seed.id) ?? 0;
  for (;;) {
    const next = pool
      .filter((s) => !window.includes(s) && (ends.includes(s.from) || ends.includes(s.to)))
      .filter((s) => (usage.get(s.id) ?? 0) >= seedUsage * SHARED_CORRIDOR_RATIO)
      .filter((s) => total + lengthOf(s.id) <= MAX_SHELTER_M)
      .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))[0];
    if (!next) return window;
    const shared = ends.find((e) => e === next.from || e === next.to)!;
    const far = next.from === shared ? next.to : next.from;
    ends = [...ends.filter((e) => e !== shared), far];
    window.push(next);
    total += lengthOf(next.id);
  }
}

function shelterFor(k: number, window: readonly PathSegment[], ctx: Context): Intervention {
  const ids = window.map((s) => s.id);
  const lengthM = ids.reduce((sum, id) => sum + (ctx.graph.lengthBySegment.get(id) ?? 0), 0);
  const street = commonName(ids, ctx.info);
  const draft: Intervention = {
    id: `shelter-${k}`,
    type: 'shelter',
    name: `Shelter on ${street ?? 'a path'}, ${abbreviate(ctx.sideOf(ids))} (${Math.round(lengthM)} m)`,
    segmentIds: ids,
    installCost: 0,
    annualMaintenance: 0,
    shadeNow: SHELTER_SHADE,
    shadeFuture: SHELTER_SHADE,
    yearsToMature: 0,
    feasibility: feasibilityOf(ids, ctx.info),
    costSource: 'estimated',
  };
  const spec = generateShelterSpec(draft, ctx.segments, ctx.unitCosts, ctx.graph.lengthBySegment);
  const installCost = roundTo(spec.totalCost, SHELTER_COST_STEP);
  return { ...draft, installCost, annualMaintenance: roundTo(installCost * SHELTER_UPKEEP_RATE, UPKEEP_STEP) };
}

function treesFor(k: number, segment: PathSegment, ctx: Context): Intervention {
  const lengthM = ctx.graph.lengthBySegment.get(segment.id) ?? 0;
  const info = ctx.info.get(segment.id);
  const draft: Intervention = {
    id: `trees-${k}`,
    type: 'tree',
    name: '',
    segmentIds: [segment.id],
    installCost: 0,
    annualMaintenance: 0,
    shadeNow: TREE_SHADE_NOW,
    shadeFuture: TREE_SHADE_FUTURE,
    yearsToMature: TREE_YEARS_TO_MATURE,
    feasibility: feasibilityOf([segment.id], ctx.info),
    costSource: 'estimated',
  };
  const spec = generateTreeSpec(draft, ctx.unitCosts, lengthM);
  const count = spec.dimensions['trees'] ?? 1;
  const where = info?.name ?? `a ${HIGHWAY_LABELS[info?.highway ?? ''] ?? 'path'}`;
  const careLine = spec.bom.find((l) => l.item === ctx.unitCosts.items['maintenanceVisit']?.label);
  return {
    ...draft,
    name: `Trees on ${where}, ${abbreviate(ctx.sideOf([segment.id]))} (${count})`,
    installCost: roundTo(spec.totalCost, TREE_COST_STEP),
    annualMaintenance: roundTo((careLine?.total ?? 0) / 2, UPKEEP_STEP),
  };
}
