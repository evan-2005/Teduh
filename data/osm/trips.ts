/**
 * Where people walk: from public transport to the places they walk to from it (malls, markets,
 * schools, clinics, places of worship, parks). Trip counts are a simple gravity estimate,
 * labelled "estimated" in the app; they are not counts.
 */
import type { DestinationKind } from '../../src/types';
import { compassName, distance, type XY } from './geometry';
import { classifyPoi, isRailStation, type Tags } from './parse';

export type PlaceRole = 'transit' | 'attractor' | 'homes';

export interface Place {
  id: string;
  kind: DestinationKind;
  role: PlaceRole;
  /** Plain-English generic name, e.g. "LRT station". */
  label: string;
  localName?: string;
  nodeId: string;
  xy: XY;
  /** Relative pull of the place: how many walking trips it starts or attracts. */
  weight: number;
}

export interface TripCandidate {
  originId: string;
  destinationId: string;
  destinationKind: DestinationKind;
  walkM: number;
  trips: number;
}

export interface SelectionLimits {
  maxJourneys: number;
  maxPerDestination: number;
  maxPerOrigin: number;
  /** Distinct origins and destinations together, so the map labels stay readable. */
  maxPlaces: number;
}

const TRIP_SCALE = 12;
const DISTANCE_DECAY_M = 500;
const MIN_TRIPS = 10;
const MERGE_TRANSIT_M = 120;
/** Schools, hospitals and malls are big sites, often mapped as a point and as their grounds. */
const MERGE_ATTRACTOR_M = 200;
const MAX_BUS_STOP_WEIGHT = 3;

type PlaceKind = Pick<Place, 'kind' | 'role' | 'label' | 'weight'>;

const attractor = (kind: DestinationKind, label: string, weight: number): PlaceKind => ({
  kind,
  role: 'attractor',
  label,
  weight,
});

const AMENITY_ATTRACTORS: Readonly<Record<string, PlaceKind>> = {
  school: attractor('school', 'School', 5),
  college: attractor('school', 'College', 5),
  university: attractor('school', 'University', 6),
  hospital: attractor('clinic', 'Hospital', 5),
  clinic: attractor('clinic', 'Clinic', 2),
  marketplace: attractor('shops', 'Market', 4),
};

const SHOP_ATTRACTORS: Readonly<Record<string, PlaceKind>> = {
  mall: attractor('mall', 'Shopping mall', 8),
  supermarket: attractor('shops', 'Supermarket', 3),
};

export const PARK_PLACE: PlaceKind = attractor('park', 'Park', 1.5);

/**
 * Public transport and the larger places people walk to. Corner shops, cafes, pharmacies and
 * kindergartens are left out: they draw few walking trips from a station or bus stop.
 */
export function placeFromTags(tags: Tags): PlaceKind | null {
  if (isRailStation(tags)) {
    const label = classifyPoi(tags)?.label ?? 'Train station';
    return { kind: 'rail-station', role: 'transit', label, weight: 10 };
  }
  if (tags['highway'] === 'bus_stop') return { kind: 'bus-stop', role: 'transit', label: 'Bus stop', weight: 1 };
  const amenity = tags['amenity'] ?? '';
  if (amenity === 'place_of_worship') {
    return attractor('worship', tags['religion'] === 'muslim' ? 'Mosque' : 'Place of worship', 2);
  }
  return AMENITY_ATTRACTORS[amenity] ?? SHOP_ATTRACTORS[tags['shop'] ?? ''] ?? null;
}

/** Walking trips per day between two places: grows with both weights, falls with distance. */
export function estimateTrips(originWeight: number, destinationWeight: number, walkM: number): number {
  const trips = TRIP_SCALE * originWeight * destinationWeight * Math.exp(-walkM / DISTANCE_DECAY_M);
  return Math.max(MIN_TRIPS, Math.round(trips));
}

/**
 * One place per real-world spot: a station mapped as several points becomes one, and bus stops
 * on opposite sides of a road become one stop that counts both (up to a cap).
 */
export function mergeNearby(places: readonly Place[]): Place[] {
  const kept: Place[] = [];
  for (const place of places) {
    const radius = place.role === 'transit' ? MERGE_TRANSIT_M : MERGE_ATTRACTOR_M;
    const index = kept.findIndex((k) => k.kind === place.kind && distance(k.xy, place.xy) <= radius);
    if (index < 0) {
      kept.push(place);
      continue;
    }
    const existing = kept[index]!;
    const weight =
      place.kind === 'bus-stop'
        ? Math.min(MAX_BUS_STOP_WEIGHT, existing.weight + place.weight)
        : Math.max(existing.weight, place.weight);
    kept[index] = { ...existing, weight, localName: existing.localName ?? place.localName };
  }
  return kept;
}

const pairKey = (c: TripCandidate): string => `${c.originId}>${c.destinationId}`;
const byTrips = (a: TripCandidate, b: TripCandidate): number =>
  b.trips - a.trips || a.walkM - b.walkM || pairKey(a).localeCompare(pairKey(b));

/**
 * The walks to model: first the busiest walk to each kind of destination (so a school or clinic
 * is not crowded out by one big mall), then the busiest of the rest, within the limits.
 */
export function selectJourneys(
  candidates: readonly TripCandidate[],
  limits: SelectionLimits,
): TripCandidate[] {
  const ranked = [...candidates].sort(byTrips);
  const chosen: TripCandidate[] = [];
  const count = (key: (c: TripCandidate) => string, value: string) =>
    chosen.filter((c) => key(c) === value).length;
  const places = () => new Set(chosen.flatMap((c) => [c.originId, c.destinationId]));
  const fits = (c: TripCandidate): boolean => {
    if (chosen.length >= limits.maxJourneys || chosen.includes(c)) return false;
    if (count((x) => x.destinationId, c.destinationId) >= limits.maxPerDestination) return false;
    if (count((x) => x.originId, c.originId) >= limits.maxPerOrigin) return false;
    const after = new Set([...places(), c.originId, c.destinationId]);
    return after.size <= limits.maxPlaces;
  };

  const kinds = [...new Set(ranked.map((c) => c.destinationKind))];
  for (const kind of kinds) {
    const best = ranked.find((c) => c.destinationKind === kind && fits(c));
    if (best) chosen.push(best);
  }
  for (const c of ranked) if (fits(c)) chosen.push(c);
  return chosen.sort(byTrips);
}

/**
 * Display names: the plain label, and only for repeats, the street it is on ("Bus stop on Majlis
 * Road") or else its compass side; a letter is the last resort. Home clusters span many streets,
 * so they always use the compass side.
 */
export function nameDestinations(
  places: readonly Place[],
  centre: XY,
  streetOf: (nodeId: string) => string | undefined = () => undefined,
): Map<string, string> {
  const draft = new Map(
    places.map((p) => {
      if (places.filter((o) => o.label === p.label).length < 2) return [p.id, p.label];
      const street = p.role === 'homes' ? undefined : streetOf(p.nodeId);
      const side = compassName(p.xy[0] - centre[0], p.xy[1] - centre[1]);
      return [p.id, street ? `${p.label} on ${street}` : `${p.label} (${side})`];
    }),
  );
  const seen = new Map<string, number>();
  return new Map(
    [...draft].map(([id, name]) => {
      const total = [...draft.values()].filter((n) => n === name).length;
      if (total < 2) return [id, name];
      const index = seen.get(name) ?? 0;
      seen.set(name, index + 1);
      return [id, `${name} ${String.fromCharCode(65 + index)}`];
    }),
  );
}
