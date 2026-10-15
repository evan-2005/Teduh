import type { AreaContext, Intervention, Journey, Neighbourhood } from '../types';

/** A place the user looked up, analysed in the browser and saved for next time. */
export interface SavedArea {
  neighbourhood: Neighbourhood;
  journeys: Journey[];
  interventions: Intervention[];
  context: AreaContext;
}

export interface SavedAreaSummary {
  slug: string;
  name: string;
  savedAt: number;
}

const INDEX_KEY = 'teduh:areas';
const AREA_KEY = (slug: string): string => `teduh:area:${slug}`;
/** Each saved area is a few hundred KB, and localStorage is about 5 MB. */
const MAX_SAVED_AREAS = 4;

const defaultStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function readIndex(storage: Storage): SavedAreaSummary[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INDEX_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as SavedAreaSummary[]) : [];
  } catch {
    return [];
  }
}

export const listCustomAreas = (storage: Storage | null = defaultStorage()): SavedAreaSummary[] =>
  storage ? readIndex(storage).sort((a, b) => b.savedAt - a.savedAt) : [];

export function loadCustomArea(
  slug: string,
  storage: Storage | null = defaultStorage(),
): SavedArea | null {
  try {
    const text = storage?.getItem(AREA_KEY(slug));
    return text ? (JSON.parse(text) as SavedArea) : null;
  } catch {
    return null;
  }
}

function forget(storage: Storage, slug: string): void {
  storage.removeItem(AREA_KEY(slug));
  storage.setItem(INDEX_KEY, JSON.stringify(readIndex(storage).filter((a) => a.slug !== slug)));
}

/**
 * Save an area, evicting the oldest ones to stay under the limit or the storage quota.
 * Returns false when the browser will not store it at all (private mode, full disk).
 */
export function saveCustomArea(
  slug: string,
  name: string,
  area: SavedArea,
  storage: Storage | null = defaultStorage(),
  now: number = Date.now(),
): boolean {
  if (!storage) return false;
  const text = JSON.stringify(area);
  for (;;) {
    try {
      storage.setItem(AREA_KEY(slug), text);
      const rest = readIndex(storage).filter((a) => a.slug !== slug);
      storage.setItem(INDEX_KEY, JSON.stringify([...rest, { slug, name, savedAt: now }]));
      break;
    } catch {
      const oldest = readIndex(storage)
        .filter((a) => a.slug !== slug)
        .sort((a, b) => a.savedAt - b.savedAt)[0];
      if (!oldest) return false;
      forget(storage, oldest.slug);
    }
  }
  const overflow = readIndex(storage)
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(MAX_SAVED_AREAS);
  overflow.forEach((a) => forget(storage, a.slug));
  return true;
}
