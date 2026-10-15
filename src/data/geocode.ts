export interface Place {
  id: string;
  /** Short English name, e.g. "Subang Jaya". */
  name: string;
  /** The rest of the address, e.g. "Petaling, Selangor, Malaysia". */
  detail: string;
  lat: number;
  lng: number;
  /** Lower-case ISO country code, used to pick the right clock offset for the sun model. */
  countryCode: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/** Left, top, right, bottom around the Klang Valley: results inside it rank higher. */
const KLANG_VALLEY_VIEWBOX = '101.2,3.5,101.95,2.75';
const MAX_RESULTS = 6;
const MAX_DETAIL_PARTS = 3;

interface NominatimItem {
  place_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: { country_code?: string };
}

export function toPlaces(items: readonly NominatimItem[]): Place[] {
  return items.flatMap((item) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !item.display_name) return [];
    const [first = item.display_name, ...rest] = item.display_name.split(',').map((p) => p.trim());
    return [
      {
        id: String(item.place_id ?? `${lat},${lng}`),
        name: item.name || first,
        detail: rest.slice(0, MAX_DETAIL_PARTS).join(', '),
        lat,
        lng,
        countryCode: item.address?.country_code ?? 'my',
      },
    ];
  });
}

export class SearchError extends Error {}

/** Look up a place by name (OpenStreetMap Nominatim). Results are asked for in English. */
export async function searchPlaces(query: string, fetchImpl: FetchLike = fetch): Promise<Place[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const params = new URLSearchParams({
    q: text,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(MAX_RESULTS),
    'accept-language': 'en',
    viewbox: KLANG_VALLEY_VIEWBOX,
  });
  let response: Response;
  try {
    response = await fetchImpl(`${NOMINATIM}?${params}`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new SearchError('Could not reach the place search. Check your internet connection.');
  }
  if (!response.ok) throw new SearchError('Place search is busy. Try again in a moment.');
  const items: unknown = await response.json().catch(() => null);
  if (!Array.isArray(items)) throw new SearchError('Place search sent a reply the app could not read.');
  return toPlaces(items as NominatimItem[]);
}
