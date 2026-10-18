/**
 * Pick the places and walks to model for a real area. Walks start at public transport (rail
 * stations, bus stops) and end at the places people walk to from it. Home clusters are only a
 * fallback, for areas where too little transit is mapped to give enough walks.
 */
import type { Destination, Journey, PathNode } from '../../src/types';
import type { Graph } from '../../src/lib/graph';
import { shortestRoute } from '../../src/lib/routing';
import { centroid, distance, type XY } from './geometry';
import type { Building, GreenFeature, Poi } from './parse';
import { exitsFor, type RailRidership } from './ridership';
import {
  capToExits,
  estimateTrips,
  mergeNearby,
  nameDestinations,
  PARK_PLACE,
  placeFromTags,
  selectJourneys,
  type Place,
  type SelectionLimits,
  type TripCandidate,
  weightFromExits,
} from './trips';

const HOME_BUILDINGS = new Set(['house', 'terrace', 'semidetached_house', 'residential', 'apartments', 'yes']);
const MAX_SNAP_M = 60;
const KMEANS_ROUNDS = 25;
/** Shorter walks barely matter for shade; longer ones are rarely made on foot. */
const MIN_WALK_M = 150;
const MAX_WALK_M = 1000;
const MIN_TRANSIT_JOURNEYS = 4;
const HOME_BUILDINGS_PER_WEIGHT = 30;
const MAX_HOME_WEIGHT = 6;
const LIMITS: SelectionLimits = { maxJourneys: 10, maxPerDestination: 2, maxPerOrigin: 4, maxPlaces: 9 };

export interface NodeXY { node: PathNode; xy: XY }

export { compassName } from './geometry';

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

type Draft = Omit<Place, 'id'>;

function snapPlace(
  kind: ReturnType<typeof placeFromTags>,
  xy: XY,
  nodes: readonly NodeXY[],
  maxM: number,
  localName?: string,
): Draft | null {
  const snap = kind ? nearestNode(nodes, xy) : null;
  if (!kind || !snap || snap.distanceM > maxM) return null;
  return { ...kind, nodeId: snap.entry.node.id, xy, ...(localName ? { localName } : {}) };
}

/** A rail station the ridership data covers takes its weight from its real exits. */
function placeKind(poi: Poi, ridership: RailRidership | undefined) {
  const kind = placeFromTags(poi.tags);
  const counted = kind?.kind === 'rail-station' ? exitsFor(poi.tags, ridership) : null;
  if (!kind || !counted) return kind;
  return { ...kind, weight: weightFromExits(counted.exits), dailyExits: counted.exits, stationCode: counted.code };
}

/** Transit stops and attractors on the path network, one per real-world spot, with stable ids. */
function placesFrom(
  pois: readonly Poi[],
  greens: readonly GreenFeature[],
  nodes: readonly NodeXY[],
  ridership: RailRidership | undefined,
): Place[] {
  const drafts = [
    ...pois.map((poi) => snapPlace(placeKind(poi, ridership), poi.xy, nodes, MAX_SNAP_M, poi.tags['name'])),
    ...greens
      .filter((g) => g.kind === 'park')
      .map((g) => snapPlace(PARK_PLACE, centroid(g.ring), nodes, MAX_SNAP_M * 2)),
  ].filter((d): d is Draft => d !== null);
  const counts = new Map<string, number>();
  const withIds = drafts.map((d) => {
    const n = (counts.get(d.kind) ?? 0) + 1;
    counts.set(d.kind, n);
    return { ...d, id: `${d.kind}-${n}` };
  });
  return mergeNearby(withIds);
}

function homePlaces(homes: readonly { centre: XY; size: number }[], nodes: readonly NodeXY[]): Place[] {
  return homes.flatMap((home, index) => {
    const snap = nearestNode(nodes, home.centre);
    if (!snap) return [];
    const weight = Math.min(MAX_HOME_WEIGHT, home.size / HOME_BUILDINGS_PER_WEIGHT);
    const place: Place = {
      id: `home-${index + 1}`,
      kind: 'home',
      role: 'homes',
      label: 'Homes',
      nodeId: snap.entry.node.id,
      xy: home.centre,
      weight,
    };
    return [place];
  });
}

/** Every walk from an origin to a target that is a sensible length on the real path network. */
function tripsBetween(graph: Graph, origins: readonly Place[], targets: readonly Place[]): TripCandidate[] {
  return origins.flatMap((origin) =>
    targets.flatMap((target) => {
      if (target.nodeId === origin.nodeId) return [];
      const walkM = shortestRoute(graph, origin.nodeId, target.nodeId)?.lengthM;
      if (walkM === undefined || walkM < MIN_WALK_M || walkM > MAX_WALK_M) return [];
      const trips = estimateTrips(origin.weight, target.weight, walkM);
      return [{ originId: origin.id, destinationId: target.id, destinationKind: target.kind, walkM, trips }];
    }),
  );
}

/** A station whose walks are scaled to its real exits, for the "How this was built" notes. */
export interface CountedStation { label: string; localName?: string; code: string; exits: number }

export interface Planned { destinations: Destination[]; journeys: Journey[]; counted: CountedStation[] }

export function planDestinations(args: {
  graph: Graph;
  nodes: readonly NodeXY[];
  homes: readonly { centre: XY; size: number }[];
  pois: readonly Poi[];
  greens: readonly GreenFeature[];
  areaCentre: XY;
  /** English name of a street at a path node, used to tell repeated places apart. */
  streetOf?: (nodeId: string) => string | undefined;
  /** Real station exits; stations it covers replace the default rail weight. */
  ridership?: RailRidership;
}): Planned {
  const { graph, nodes, homes, pois, greens, areaCentre } = args;
  const places = placesFrom(pois, greens, nodes, args.ridership);
  const transit = places.filter((p) => p.role === 'transit');
  const attractors = places.filter((p) => p.role === 'attractor');

  let candidates = tripsBetween(graph, transit, attractors);
  let chosen = selectJourneys(candidates, LIMITS);
  const homesUsed = chosen.length < MIN_TRANSIT_JOURNEYS ? homePlaces(homes, nodes) : [];
  if (homesUsed.length > 0) {
    // Too little transit: residents walking to the stops and to the attractors fill the gap.
    candidates = [...candidates, ...tripsBetween(graph, homesUsed, [...transit, ...attractors])];
    chosen = selectJourneys(candidates, LIMITS);
  }
  chosen = capToExits(chosen, places);

  const usedIds = new Set(chosen.flatMap((c) => [c.originId, c.destinationId]));
  const used = [...transit, ...homesUsed, ...attractors].filter((p) => usedIds.has(p.id));
  const names = nameDestinations(used, areaCentre, args.streetOf);
  const destinations: Destination[] = used.map((p) => ({
    id: `dest-${p.id}`,
    nodeId: p.nodeId,
    name: names.get(p.id) ?? p.label,
    kind: p.kind,
    ...(p.localName ? { localName: p.localName } : {}),
  }));
  const journeys: Journey[] = chosen.map((c) => ({
    id: `j-${c.originId}-to-${c.destinationId}`,
    originId: `dest-${c.originId}`,
    destinationId: `dest-${c.destinationId}`,
    dailyTrips: c.trips,
    tripsSource: 'estimated',
  }));
  const counted = used.flatMap((p) =>
    p.dailyExits && p.stationCode
      ? [{ label: p.label, code: p.stationCode, exits: p.dailyExits, ...(p.localName ? { localName: p.localName } : {}) }]
      : [],
  );
  return { destinations, journeys, counted };
}
