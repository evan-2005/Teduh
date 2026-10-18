import { AreaTooSparseError, buildArea } from '../../data/osm/pipeline';
import type { RawElement } from '../../data/osm/parse';
import { fetchOverpass, type Area, type FetchLike } from '../../data/osm/overpass';
import ridershipRaw from '../../data/rail-ridership.json';
import type { RailRidership } from '../../data/osm/ridership';
import unitCostsRaw from '../../data/unit-costs.json';
import type { UnitCosts } from '../types';
import { saveCustomArea } from './customAreas';
import type { Place } from './geocode';
import { CUSTOM_PREFIX, type AreaId } from './load';

/** Query radius around the place centre; the network keeps the inner part (see the pipeline). */
const ANALYSIS_RADIUS_M = 550;
const MALAYSIA_CODE = 'my';
const LONGITUDE_PER_HOUR = 15;
const UI_YIELD_MS = 30;

/** A failure with a message that is safe and useful to show to the user. */
export class AnalyseError extends Error {}

export interface AnalyseDeps {
  fetchImpl?: FetchLike;
  unitCosts?: UnitCosts;
  storage?: Storage | null;
  retry?: { maxAttempts?: number; baseWaitMs?: number };
}

export function slugFor(place: Pick<Place, 'name' | 'lat' | 'lng'>): string {
  const words = place.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${words || 'place'}-${Math.abs(Math.round(place.lat * 1000))}-${Math.abs(Math.round(place.lng * 1000))}`;
}

const nextFrame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, UI_YIELD_MS));

/**
 * Download the map data for a place, build and save its dataset in this browser, and return
 * the area id to load. Runs entirely client-side; progress messages are plain English.
 */
export async function analysePlace(
  place: Place,
  onProgress: (message: string) => void,
  deps: AnalyseDeps = {},
): Promise<AreaId> {
  const area: Area = {
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    radiusM: ANALYSIS_RADIUS_M,
    utcOffsetH:
      place.countryCode === MALAYSIA_CODE ? undefined : Math.round(place.lng / LONGITUDE_PER_HOUR),
  };

  onProgress('Downloading streets, buildings and places from OpenStreetMap…');
  let elements: RawElement[];
  try {
    const raw = (await fetchOverpass(
      area,
      () => onProgress('The map server is busy. Trying again…'),
      deps.fetchImpl,
      deps.retry,
    )) as { elements?: RawElement[] };
    elements = raw.elements ?? [];
  } catch {
    throw new AnalyseError('Could not download map data. Check your internet connection and try again in a minute.');
  }

  onProgress('Building the path network and estimating shade…');
  await nextFrame();
  let built;
  try {
    built = buildArea({
      area,
      elements,
      unitCosts: (deps.unitCosts ?? (unitCostsRaw as unknown as UnitCosts)),
      fetchedAt: new Date().toISOString(),
      ridership: ridershipRaw as RailRidership,
    });
  } catch (error) {
    if (error instanceof AreaTooSparseError) throw new AnalyseError(error.message);
    throw new AnalyseError('Something went wrong while analysing this area. Try a nearby place.');
  }

  onProgress('Saving the area in this browser…');
  const slug = slugFor(place);
  const saved = saveCustomArea(slug, place.name, built, deps.storage);
  if (!saved) {
    throw new AnalyseError('This browser would not store the area (private mode or full storage).');
  }
  return `${CUSTOM_PREFIX}${slug}`;
}
