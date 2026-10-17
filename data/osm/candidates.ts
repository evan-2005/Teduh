/**
 * Generate candidate shelters and street-tree rows where exposed paths carry the most trips.
 * Costs come from the same bottom-up bill of materials the Fabrication panel shows, so the
 * simulator and the build pack agree.
 */
import { DEFAULT_DETOUR, EXPOSED_THRESHOLD } from '../../src/config';
import { generateShelterSpec, generateTreeSpec } from '../../src/features/fabrication/spec';
import type { Graph } from '../../src/lib/graph';
import { anchorReach, walkwayStart } from '../../src/lib/anchors';
import { leastSunRoute } from '../../src/lib/routing';
import {
  SHELTER_LENGTH,
  SHELTER_SHADE,
  shelterPlanningCost,
  TREE_SHADE_FUTURE,
  TREE_SHADE_NOW,
  TREE_YEARS_TO_MATURE,
  treePlanningCost,
} from '../../src/lib/planting';
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
const SHARED_CORRIDOR_RATIO = 0.5;
/** Street trees go in as a run along a block, not one or two at a time: 5 to 20 trees. */
const MIN_TREE_ROW_M = 40;
const MAX_TREE_ROW_M = 160;
/** Trees help any walked exposed path, so a row may continue into less busy stretches. */
const TREE_CORRIDOR_RATIO = 0.25;
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

interface Picker {
  ctx: Context;
  usage: ReadonlyMap<string, number>;
  lengthOf: (id: string) => number;
  /** Trips x length x sun: how much an exposed segment matters. */
  score: (s: PathSegment) => number;
  /** Exposed, used segments not yet taken by a candidate. */
  free: () => PathSegment[];
  used: Set<string>;
}

function createPicker(ctx: Context): Picker {
  const usage = usageBySegment(ctx);
  const lengthOf = (id: string): number => ctx.graph.lengthBySegment.get(id) ?? 0;
  const shade14 = (s: PathSegment): number => s.shade['14:00'];
  const exposed = ctx.segments.filter((s) => s.accessible && shade14(s) < EXPOSED_THRESHOLD);
  const used = new Set<string>();
  const score = (s: PathSegment): number => (usage.get(s.id) ?? 0) * lengthOf(s.id) * (1 - shade14(s));
  const free = (): PathSegment[] => exposed.filter((s) => !used.has(s.id) && score(s) > 0);
  return { ctx, usage, lengthOf, score, free, used };
}

export function generateCandidates(ctx: Context): Intervention[] {
  const picker = createPicker(ctx);
  const shelters = pickShelters(picker);
  return uniqueNames([...shelters, ...pickTreeRows(picker)]);
}

/**
 * Covered walkways go where people wait or arrive: they start at a bus stop, a station, or the
 * entrance of a place people walk to, and run away from it along the busiest exposed path.
 * A shelter may not touch an earlier one: otherwise the next "candidate" is just the
 * neighbouring stretch of the same corridor, serving the same trips (an interchangeable twin).
 */
function pickShelters(p: Picker): Intervention[] {
  const anchors = anchorReach(p.ctx.segments, p.ctx.destinations, p.lengthOf);
  const anchorOf = (s: PathSegment): Destination | undefined => anchors.get(s.from) ?? anchors.get(s.to);
  const shelterNodes = new Set<string>();
  const freeForShelter = (): PathSegment[] =>
    p.free().filter((s) => !shelterNodes.has(s.from) && !shelterNodes.has(s.to));
  const result: Intervention[] = [];
  for (let k = 1; k <= SHELTER_COUNT; k++) {
    const seed = freeForShelter()
      .filter((s) => anchorOf(s))
      .sort((a, b) => p.score(b) - p.score(a))[0];
    if (!seed) break;
    const anchor = anchorOf(seed)!;
    const window = growWindow(seed, freeForShelter(), p.usage, p.lengthOf, {
      ...SHELTER_WINDOW,
      closedEnd: walkwayStart(seed, anchors),
    });
    window.forEach((s) => {
      p.used.add(s.id);
      shelterNodes.add(s.from);
      shelterNodes.add(s.to);
    });
    result.push(shelterFor(k, window, anchor, p.ctx));
  }
  return result;
}

function pickTreeRows(p: Picker): Intervention[] {
  const streetOf = (s: PathSegment): string => p.ctx.info.get(s.id)?.name ?? s.id;
  const perStreet = new Map<string, number>();
  const result: Intervention[] = [];
  for (const seed of p.free().sort((a, b) => p.score(b) - p.score(a))) {
    const street = streetOf(seed);
    if (result.length >= TREE_COUNT) break;
    if (p.used.has(seed.id) || (perStreet.get(street) ?? 0) >= MAX_TREE_ROWS_PER_STREET) continue;
    const row = growWindow(seed, p.free(), p.usage, p.lengthOf, {
      maxM: MAX_TREE_ROW_M,
      minShare: TREE_CORRIDOR_RATIO,
      prefer: (s) => streetOf(s) === street,
    });
    if (row.reduce((sum, s) => sum + p.lengthOf(s.id), 0) < MIN_TREE_ROW_M) continue;
    row.forEach((s) => p.used.add(s.id));
    perStreet.set(street, (perStreet.get(street) ?? 0) + 1);
    result.push(treesFor(result.length + 1, row, p.ctx));
  }
  return result;
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

interface WindowOptions {
  /** Longest run, in metres. */
  maxM: number;
  /** A neighbour joins only if it carries at least this share of the seed's trips. */
  minShare: number;
  /** Neighbours to try first, e.g. ones on the same street, so a row follows the street. */
  prefer?: (s: PathSegment) => boolean;
  /** A node the run must not grow past, e.g. the bus stop a walkway starts at. */
  closedEnd?: string;
}

const SHELTER_WINDOW: WindowOptions = { maxM: SHELTER_LENGTH.max, minShare: SHARED_CORRIDOR_RATIO };

/** Extend a seed segment along neighbouring busy exposed segments (a shared corridor). */
function growWindow(
  seed: PathSegment,
  pool: readonly PathSegment[],
  usage: ReadonlyMap<string, number>,
  lengthOf: (id: string) => number,
  options: WindowOptions = SHELTER_WINDOW,
): PathSegment[] {
  const window = [seed];
  let ends = [seed.from, seed.to].filter((e) => e !== options.closedEnd);
  let total = lengthOf(seed.id);
  const seedUsage = usage.get(seed.id) ?? 0;
  const preferred = (s: PathSegment): number => (options.prefer?.(s) ? 1 : 0);
  for (;;) {
    const next = pool
      .filter((s) => !window.includes(s) && (ends.includes(s.from) || ends.includes(s.to)))
      .filter((s) => (usage.get(s.id) ?? 0) >= seedUsage * options.minShare)
      .filter((s) => total + lengthOf(s.id) <= options.maxM)
      .sort(
        (a, b) => preferred(b) - preferred(a) || (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0),
      )[0];
    if (!next) return window;
    const shared = ends.find((e) => e === next.from || e === next.to)!;
    const far = next.from === shared ? next.to : next.from;
    ends = [...ends.filter((e) => e !== shared), far];
    window.push(next);
    total += lengthOf(next.id);
  }
}

/** "Bus stop on X" -> "bus stop on X"; "LRT station" keeps its capitals. */
const lowerFirst = (text: string): string =>
  /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;

function shelterFor(k: number, window: readonly PathSegment[], anchor: Destination, ctx: Context): Intervention {
  const ids = window.map((s) => s.id);
  const lengthM = ids.reduce((sum, id) => sum + (ctx.graph.lengthBySegment.get(id) ?? 0), 0);
  const street = commonName(ids, ctx.info);
  const joiner = anchor.name.includes(' on ') ? ', along' : ' on';
  const along = street && !anchor.name.includes(street) ? `${joiner} ${street}` : '';
  const draft: Intervention = {
    id: `shelter-${k}`,
    type: 'shelter',
    name: `Covered walkway from the ${lowerFirst(anchor.name)}${along} (${Math.round(lengthM)} m)`,
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
  return { ...draft, ...shelterPlanningCost(spec) };
}

function treesFor(k: number, row: readonly PathSegment[], ctx: Context): Intervention {
  const ids = row.map((s) => s.id);
  const lengthM = ids.reduce((sum, id) => sum + (ctx.graph.lengthBySegment.get(id) ?? 0), 0);
  const info = ctx.info.get(ids[0]!);
  const draft: Intervention = {
    id: `trees-${k}`,
    type: 'tree',
    name: '',
    segmentIds: ids,
    installCost: 0,
    annualMaintenance: 0,
    shadeNow: TREE_SHADE_NOW,
    shadeFuture: TREE_SHADE_FUTURE,
    yearsToMature: TREE_YEARS_TO_MATURE,
    feasibility: feasibilityOf(ids, ctx.info),
    costSource: 'estimated',
  };
  const spec = generateTreeSpec(draft, ctx.unitCosts, lengthM);
  const count = spec.dimensions['trees'] ?? 1;
  const where = commonName(ids, ctx.info) ?? `a ${HIGHWAY_LABELS[info?.highway ?? ''] ?? 'path'}`;
  return {
    ...draft,
    name: `Trees on ${where}, ${abbreviate(ctx.sideOf(ids))} (${count} trees)`,
    ...treePlanningCost(spec, ctx.unitCosts),
  };
}
