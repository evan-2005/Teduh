/** Turn raw Overpass JSON into typed, projected features. */
import type { LandmarkKind } from '../../src/types';
import { centroid, type Projection, type XY } from './geometry';

interface RawPoint { lat: number; lon: number }
interface RawBounds { minlat: number; minlon: number; maxlat: number; maxlon: number }
export interface RawElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  bounds?: RawBounds;
  geometry?: RawPoint[];
  tags?: Record<string, string>;
}

export type Tags = Record<string, string>;

export interface Highway { id: number; tags: Tags; points: XY[] }
export interface Building {
  id: number;
  ring: XY[];
  heightM: number;
  /** The OpenStreetMap building= value, e.g. house, retail, school. */
  kind: string;
}
export interface GreenFeature { kind: 'park' | 'playground' | 'pitch' | 'garden'; ring: XY[] }
export interface Poi { id: string; tags: Tags; xy: XY; landmark: LandmarkKind; label: string }

export interface ParsedOsm {
  highways: Highway[];
  buildings: Building[];
  greens: GreenFeature[];
  trees: XY[];
  pois: Poi[];
}

const WALKABLE = new Set([
  'footway', 'pedestrian', 'path', 'steps', 'residential', 'living_street', 'unclassified',
  'tertiary', 'secondary', 'primary', 'service', 'cycleway', 'track',
]);
const NON_WALKABLE_SERVICE = new Set(['parking_aisle', 'driveway', 'drive-through', 'emergency_access']);
const DEFAULT_HEIGHT_M = 7; // a two-storey house
const METRES_PER_LEVEL = 3.2;
const HEIGHT_BY_BUILDING: Readonly<Record<string, number>> = {
  house: 7, terrace: 7, semidetached_house: 7, residential: 7, yes: 7, roof: 3,
  retail: 10, commercial: 10, school: 10, mosque: 12, apartments: 30, industrial: 8,
};
const GREEN_KINDS = new Set(['park', 'playground', 'garden', 'pitch']);

export function isWalkable(tags: Tags): boolean {
  const kind = tags['highway'];
  if (!kind || !WALKABLE.has(kind)) return false;
  if (kind === 'service' && NON_WALKABLE_SERVICE.has(tags['service'] ?? '')) return false;
  if (tags['foot'] === 'no' || tags['access'] === 'private' || tags['access'] === 'no') return false;
  return true;
}

export function buildingHeightM(tags: Tags): number {
  const explicit = Number.parseFloat(tags['height'] ?? '');
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const levels = Number.parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(levels) && levels > 0) return levels * METRES_PER_LEVEL + 1;
  return HEIGHT_BY_BUILDING[tags['building'] ?? ''] ?? DEFAULT_HEIGHT_M;
}

const RAIL_LABELS: Readonly<Record<string, string>> = {
  light_rail: 'LRT station',
  subway: 'MRT station',
  monorail: 'Monorail station',
};

/** True for a rail station or halt (Overpass often returns several points for one station). */
export const isRailStation = (tags: Tags): boolean =>
  tags['railway'] === 'station' || tags['railway'] === 'halt' || tags['public_transport'] === 'station';

/** Plain-English kind and generic name for a mapped place, or null if we do not show it. */
export function classifyPoi(tags: Tags): { landmark: LandmarkKind; label: string } | null {
  const amenity = tags['amenity'];
  const shop = tags['shop'];
  if (isRailStation(tags)) {
    return { landmark: 'rail-station', label: RAIL_LABELS[tags['station'] ?? ''] ?? 'Train station' };
  }
  if (tags['highway'] === 'bus_stop') return { landmark: 'bus-stop', label: 'Bus stop' };
  if (amenity === 'school') return { landmark: 'school', label: 'School' };
  if (amenity === 'kindergarten') return { landmark: 'school', label: 'Kindergarten' };
  if (amenity === 'college' || amenity === 'university') {
    return { landmark: 'school', label: amenity === 'university' ? 'University' : 'College' };
  }
  if (amenity === 'place_of_worship') {
    return { landmark: 'worship', label: tags['religion'] === 'muslim' ? 'Mosque' : 'Place of worship' };
  }
  if (amenity === 'clinic' || amenity === 'hospital' || amenity === 'pharmacy') {
    const label = amenity === 'hospital' ? 'Hospital' : amenity === 'pharmacy' ? 'Pharmacy' : 'Clinic';
    return { landmark: 'health', label };
  }
  if (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'food_court') {
    return { landmark: 'food', label: amenity === 'cafe' ? 'Cafe' : 'Restaurant' };
  }
  if (amenity === 'marketplace') return { landmark: 'shops', label: 'Market' };
  if (shop === 'mall') return { landmark: 'shops', label: 'Shopping mall' };
  if (shop === 'supermarket') return { landmark: 'shops', label: 'Supermarket' };
  if (shop) return { landmark: 'shops', label: shop === 'convenience' ? 'Convenience store' : 'Shop' };
  if (amenity) return { landmark: 'other', label: 'Public facility' };
  return null;
}

const centre = (element: RawElement, proj: Projection): XY | null => {
  if (element.lat !== undefined && element.lon !== undefined) return proj.toXY(element.lat, element.lon);
  if (element.geometry?.length) return centroid(element.geometry.map((p) => proj.toXY(p.lat, p.lon)));
  const b = element.bounds;
  return b ? proj.toXY((b.minlat + b.maxlat) / 2, (b.minlon + b.maxlon) / 2) : null;
};

const ringOf = (element: RawElement, proj: Projection): XY[] =>
  (element.geometry ?? []).map((p) => proj.toXY(p.lat, p.lon));

export function parseOsm(elements: readonly RawElement[], proj: Projection): ParsedOsm {
  const result: ParsedOsm = { highways: [], buildings: [], greens: [], trees: [], pois: [] };

  for (const element of elements) {
    const tags = element.tags ?? {};

    if (element.type === 'way' && tags['highway'] && isWalkable(tags)) {
      const points = ringOf(element, proj);
      if (points.length >= 2) result.highways.push({ id: element.id, tags, points });
    } else if (element.type === 'way' && tags['building']) {
      const ring = ringOf(element, proj);
      if (ring.length >= 4) result.buildings.push({
          id: element.id,
          ring: ring.slice(0, -1),
          heightM: buildingHeightM(tags),
          kind: tags['building'] ?? 'yes',
        });
    } else if (tags['natural'] === 'tree' && element.type === 'node') {
      const xy = centre(element, proj);
      if (xy) result.trees.push(xy);
    } else if (tags['natural'] === 'tree_row' && element.type === 'way') {
      result.trees.push(...ringOf(element, proj));
    }

    const green = tags['leisure'];
    if (green && GREEN_KINDS.has(green) && element.type === 'way') {
      const ring = ringOf(element, proj);
      if (ring.length >= 4) result.greens.push({ kind: green as GreenFeature['kind'], ring: ring.slice(0, -1) });
    }

    const poi = classifyPoi(tags);
    const xy = poi ? centre(element, proj) : null;
    // Buildings tagged as a school or mosque are the same place as the amenity; keep the amenity.
    // Rail stations are usually mapped only as a station roof, so keep those outlines.
    const plainBuilding = element.type === 'way' && tags['building'] && !tags['amenity'] && !tags['shop'];
    if (poi && xy && (!plainBuilding || isRailStation(tags))) {
      result.pois.push({ id: `${element.type[0]}${element.id}`, tags, xy, ...poi });
    }
  }
  return result;
}

const ENGLISH_STREET_TYPES: readonly [RegExp, string][] = [
  [/^Jalan\s+(.+)$/i, '$1 Road'],
  [/^Lorong\s+(.+)$/i, '$1 Lane'],
  [/^Persiaran\s+(.+)$/i, '$1 Avenue'],
  [/^Lebuhraya\s+(.+)$/i, '$1 Expressway'],
  [/^Lebuh\s+(.+)$/i, '$1 Street'],
];

/** "Jalan SS 4C/3" -> "SS 4C/3 Road". Other proper names are left alone. */
export function englishStreetName(name: string): string {
  for (const [pattern, replacement] of ENGLISH_STREET_TYPES) {
    if (pattern.test(name)) return name.replace(pattern, replacement);
  }
  return name;
}
