/** Pick homes, destinations and journeys for a real area. */
import type { Destination, DestinationKind, Journey, PathNode } from '../../src/types';
import type { Graph } from '../../src/lib/graph';
import { shortestRoute } from '../../src/lib/routing';
import { centroid, distance, type XY } from './geometry';
import type { Building, GreenFeature, Poi } from './parse';

const HOME_BUILDINGS = new Set(['house', 'terrace', 'semidetached_house', 'residential', 'apartments', 'yes']);
const MAX_SNAP_M = 60;
const SKIPPED_LABELS = new Set(['Kindergarten', 'Pharmacy']);
const MIN_WALK_M = 300;
const TARGET_WALK_M = 650;
const KMEANS_ROUNDS = 25;
const MIN_TRIPS = 20;
/** Daily trips per nearby building: deliberately rough, and labelled "estimated". */
const TRIPS_PER_BUILDING: Readonly<Record<string, number>> = {
  school: 0.1,
  clinic: 0.03,
  'bus-stop': 0.2,
  shops: 0.25,
  park: 0.06,
};
const COMPASS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];

export interface NodeXY { node: PathNode; xy: XY }

export const compassName = (dx: number, dy: number): string =>
  COMPASS[Math.round((Math.atan2(dy, dx) / (Math.PI / 4) + 8) % 8) % 8]!;

/** Two clusters of homes (k-means with a deterministic start). Returns centroid and size. */
export function clusterHomes(buildings: readonly Building[]): { centre: XY; size: number }[] {
  const points = buildings.map((b) => centroid(b.ring));
  if (points.length < 2) return points.length === 1 ? [{ centre: points[0]!, size: 1 }] : [];
  const sums = points.map((p) => p[0] + p[1]);
  let centres: XY[] = [points[sums.indexOf(Math.min(...sums))]!, points[sums.indexOf(Math.max(...sums))]!];
  let groups: XY[][] = [[], []];
  for (let round = 0; round < KMEANS_ROUNDS; round++) {
    groups = [[], []];
    for (const p of points) groups[distance(p, centres[0]!) <= distance(p, centres[1]!) ? 0 : 1]!.push(p);
    centres = groups.map((g, i) => (g.length ? centroid(g) : centres[i]!));
  }
  return groups.map((g, i) => ({ centre: centres[i]!, size: g.length })).filter((c) => c.size > 0);
}

export const residentialBuildings = (buildings: readonly Building[]): Building[] =>
  buildings.filter((b) => HOME_BUILDINGS.has(b.kind));

function nearestNode(nodes: readonly NodeXY[], xy: XY): { entry: NodeXY; distanceM: number } | null {
  let best: { entry: NodeXY; distanceM: number } | null = null;
  for (const entry of nodes) {
    const d = distance(entry.xy, xy);
    if (!best || d < best.distanceM) best = { entry, distanceM: d };
  }
  return best;
}

interface Candidate { kind: DestinationKind; node: PathNode; name: string; localName?: string }

/** Candidate destinations mapped to the network, grouped by kind. */
function candidatesOf(pois: readonly Poi[], greens: readonly GreenFeature[], nodes: readonly NodeXY[]): Candidate[] {
  const wanted: Record<string, DestinationKind> = {
    school: 'school',
    'bus-stop': 'bus-stop',
    shops: 'shops',
    health: 'clinic',
  };
  const result: Candidate[] = [];
  for (const poi of pois) {
    const kind = wanted[poi.landmark];
    const snap = kind ? nearestNode(nodes, poi.xy) : null;
    if (kind && snap && snap.distanceM <= MAX_SNAP_M && !SKIPPED_LABELS.has(poi.label)) {
      result.push({ kind, node: snap.entry.node, name: poi.label, localName: poi.tags['name'] });
    }
  }
  for (const green of greens.filter((g) => g.kind === 'park')) {
    const snap = nearestNode(nodes, centroid(green.ring));
    if (snap && snap.distanceM <= MAX_SNAP_M * 2) result.push({ kind: 'park', node: snap.entry.node, name: 'Park' });
  }
  return result;
}

function walkFrom(graph: Graph, from: string, to: string): number | null {
  return shortestRoute(graph, from, to)?.lengthM ?? null;
}

export interface Planned { destinations: Destination[]; journeys: Journey[] }

export function planDestinations(args: {
  graph: Graph;
  nodes: readonly NodeXY[];
  homes: readonly { centre: XY; size: number }[];
  pois: readonly Poi[];
  greens: readonly GreenFeature[];
  areaCentre: XY;
}): Planned {
  const { graph, nodes, homes, pois, greens, areaCentre } = args;
  const destinations: Destination[] = [];
  const homeEntries: { dest: Destination; size: number }[] = [];

  homes.forEach((home, index) => {
    const snap = nearestNode(nodes, home.centre);
    if (!snap) return;
    const where = compassName(home.centre[0] - areaCentre[0], home.centre[1] - areaCentre[1]);
    const dest: Destination = {
      id: `dest-home-${index + 1}`,
      nodeId: snap.entry.node.id,
      name: `Homes (${where})`,
      kind: 'home',
    };
    destinations.push(dest);
    homeEntries.push({ dest, size: home.size });
  });

  const journeys: Journey[] = [];
  const all = candidatesOf(pois, greens, nodes);
  for (const kind of ['school', 'bus-stop', 'shops', 'clinic', 'park'] as const) {
    const scored = all
      .filter((c) => c.kind === kind)
      .map((c) => {
        const walks = homeEntries.map((h) => walkFrom(graph, h.dest.nodeId, c.node.id));
        if (walks.some((w) => w === null)) return null;
        const average = (walks as number[]).reduce((a, b) => a + b, 0) / walks.length;
        return average >= MIN_WALK_M ? { c, miss: Math.abs(average - TARGET_WALK_M) } : null;
      })
      .filter((x): x is { c: Candidate; miss: number } => x !== null)
      .sort((a, b) => a.miss - b.miss);
    const chosen = scored[0]?.c;
    if (!chosen) continue;

    const dest: Destination = {
      id: `dest-${kind}`,
      nodeId: chosen.node.id,
      name: chosen.name,
      kind,
      ...(chosen.localName ? { localName: chosen.localName } : {}),
    };
    destinations.push(dest);
    for (const home of homeEntries) {
      journeys.push({
        id: `j-${home.dest.id.replace('dest-', '')}-${kind}`,
        originId: home.dest.id,
        destinationId: dest.id,
        dailyTrips: Math.max(MIN_TRIPS, Math.round(home.size * (TRIPS_PER_BUILDING[kind] ?? 0.1))),
        tripsSource: 'estimated',
      });
    }
  }
  return { destinations, journeys };
}
