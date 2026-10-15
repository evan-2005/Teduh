/** Fetch everything the network builder needs from OpenStreetMap (Overpass API). */

export interface Area {
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Clock offset from UTC for the sun model; Malaysia (UTC+8) when absent. */
  utcOffsetH?: number;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'teduh-hackathon/0.1 (student prototype)';
const MAX_ATTEMPTS = 8;
const BASE_WAIT_MS = 5000;
const REQUEST_TIMEOUT_MS = 170_000;

const WALKABLE_HIGHWAYS =
  'footway|pedestrian|path|steps|residential|living_street|unclassified|tertiary|secondary|service|cycleway|track|primary';
const AMENITIES =
  'school|kindergarten|college|university|clinic|hospital|marketplace|place_of_worship|library|community_centre|food_court|restaurant|cafe|bank|pharmacy';

export function buildQuery({ lat, lng, radiusM }: Area): string {
  const around = `(around:${radiusM},${lat},${lng})`;
  return `[out:json][timeout:120];
(
  way["highway"~"^(${WALKABLE_HIGHWAYS})$"]${around};
  way["building"]${around};
  way["natural"="tree_row"]${around};
  way["leisure"~"^(park|playground|garden|pitch)$"]${around};
  node["natural"="tree"]${around};
  nwr["amenity"~"^(${AMENITIES})$"]${around};
  nwr["shop"]${around};
  nwr["highway"="bus_stop"]${around};
  nwr["public_transport"~"^(platform|stop_position|station)$"]${around};
  nwr["railway"~"^(station|stop)$"]${around};
);
out geom tags;`;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The public servers are often busy, so retry with backoff and rotate endpoints. */
export async function fetchOverpass(
  area: Area,
  log: (msg: string) => void,
  fetchImpl: FetchLike = fetch,
  options: { maxAttempts?: number; baseWaitMs?: number } = {},
): Promise<unknown> {
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const baseWaitMs = options.baseWaitMs ?? BASE_WAIT_MS;
  const body = new URLSearchParams({ data: buildQuery(area) });
  // Browsers set their own User-Agent; Node needs one or the servers answer 406.
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (typeof window === 'undefined') headers['User-Agent'] = USER_AGENT;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]!;
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        body,
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      if (response.ok && text.trimStart().startsWith('{')) return JSON.parse(text);
      log(`attempt ${attempt + 1}: ${endpoint} answered ${response.status}`);
    } catch (error) {
      log(`attempt ${attempt + 1}: ${endpoint} failed (${(error as Error).name})`);
    }
    await sleep(baseWaitMs * (attempt + 1));
  }
  throw new Error('Could not reach any Overpass server. Try again in a few minutes.');
}
