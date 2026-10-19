import { describe, expect, test } from 'vitest';
import { AreaTooSparseError, buildArea } from '../../data/osm/pipeline';
import { fetchOverpass } from '../../data/osm/overpass';
import unitCostsRaw from '../../data/unit-costs.json';
import type { UnitCosts } from '../types';
import { AnalyseError, analysePlace, slugFor } from './analysePlace';
import { areaContextSchema } from './context';
import { listCustomAreas, loadCustomArea, saveCustomArea, type SavedArea } from './customAreas';
import { searchPlaces, SearchError, toPlaces } from './geocode';
import { MINI_AREA, miniAreaElements } from './fixtures/miniArea';
import { parseDataset } from './load';

const unitCosts = unitCostsRaw as unknown as UnitCosts;

/** A minimal in-memory Storage with an optional size limit, to test eviction. */
class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  constructor(private readonly maxChars = Infinity) {}
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    const used = [...this.data.entries()].filter(([k]) => k !== key).reduce((s, [, v]) => s + v.length, 0);
    if (used + value.length > this.maxChars) throw new DOMException('full', 'QuotaExceededError');
    this.data.set(key, value);
  }
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('place search', () => {
  const nominatim = [
    { place_id: 1, lat: '3.0775', lon: '101.5870', display_name: 'SS 15, Subang Jaya, Petaling, Selangor, Malaysia', address: { country_code: 'my' } },
    { place_id: 2, lat: 'nope', lon: '1', display_name: 'Broken' },
    { place_id: 3, lat: '1.3', lon: '103.8', name: 'Bishan', display_name: 'Bishan, Singapore', address: { country_code: 'sg' } },
  ];

  test('turns results into short names and drops unusable ones', () => {
    const places = toPlaces(nominatim);
    expect(places.map((p) => p.name)).toEqual(['SS 15', 'Bishan']);
    expect(places[0]).toMatchObject({ lat: 3.0775, lng: 101.587, countryCode: 'my' });
    expect(places[0]!.detail).toBe('Subang Jaya, Petaling, Selangor');
  });

  test('asks for English results around the Klang Valley', async () => {
    let url = '';
    await searchPlaces('Subang', async (input) => {
      url = input;
      return json(nominatim);
    });
    expect(url).toContain('accept-language=en');
    expect(url).toContain('viewbox=');
    expect(url).toContain('q=Subang');
  });

  test('ignores very short queries and gives friendly errors', async () => {
    expect(await searchPlaces(' a ', async () => json([]))).toEqual([]);
    await expect(searchPlaces('Subang', async () => { throw new TypeError('offline'); })).rejects.toThrow(/internet/);
    await expect(searchPlaces('Subang', async () => json({}, 503))).rejects.toThrow(SearchError);
    await expect(searchPlaces('Subang', async () => json({ not: 'a list' }))).rejects.toThrow(/could not read/);
  });
});

describe('browser-saved areas', () => {
  const area = {} as SavedArea;

  test('save, list newest first, and load back', () => {
    const storage = new MemoryStorage();
    saveCustomArea('a', 'Alpha', { ...area, journeys: [] }, storage, 1);
    saveCustomArea('b', 'Beta', { ...area, journeys: [] }, storage, 2);
    expect(listCustomAreas(storage).map((s) => s.slug)).toEqual(['b', 'a']);
    expect(loadCustomArea('a', storage)).toEqual({ journeys: [] });
    expect(loadCustomArea('zzz', storage)).toBeNull();
  });

  test('keeps at most four areas, dropping the oldest', () => {
    const storage = new MemoryStorage();
    ['a', 'b', 'c', 'd', 'e'].forEach((slug, i) => saveCustomArea(slug, slug, { ...area, journeys: [] }, storage, i));
    expect(listCustomAreas(storage).map((s) => s.slug)).toEqual(['e', 'd', 'c', 'b']);
    expect(loadCustomArea('a', storage)).toBeNull();
  });

  test('evicts old areas when storage is full, and reports failure when nothing fits', () => {
    const big = { ...area, journeys: [{ pad: 'x'.repeat(100) }] } as unknown as SavedArea;
    const storage = new MemoryStorage(400);
    saveCustomArea('a', 'A', big, storage, 1);
    saveCustomArea('b', 'B', big, storage, 2);
    saveCustomArea('c', 'C', big, storage, 3);
    expect(loadCustomArea('c', storage)).not.toBeNull();
    expect(saveCustomArea('huge', 'H', { ...area, journeys: [{ pad: 'x'.repeat(5000) }] } as unknown as SavedArea, new MemoryStorage(100), 4)).toBe(false);
  });

  test('works without any storage', () => {
    expect(saveCustomArea('a', 'A', area, null)).toBe(false);
    expect(listCustomAreas(null)).toEqual([]);
  });
});

describe('area pipeline on a synthetic town', () => {
  const build = () =>
    buildArea({ area: MINI_AREA, elements: miniAreaElements(), unitCosts, fetchedAt: '2026-10-15T00:00:00Z' });

  test('builds a complete dataset that passes the app schema and reference checks', () => {
    const built = build();
    const data = parseDataset({ ...built, unitCosts });
    expect(data.neighbourhood.segments.length).toBeGreaterThanOrEqual(40);
    expect(data.journeys.length).toBeGreaterThanOrEqual(4);
    expect(data.interventions.length).toBeGreaterThanOrEqual(2);
    expect(areaContextSchema.safeParse(built.context).success).toBe(true);
    expect(built.neighbourhood.meta!.source).toBe('openstreetmap');
  });

  test('names things in English and keeps the local name as secondary detail', () => {
    const { neighbourhood } = build();
    const school = neighbourhood.destinations.find((d) => d.kind === 'school');
    expect(school?.name).toBe('School');
    expect(school?.localName).toBe('Sekolah Ujian');
    expect(neighbourhood.segments.some((s) => s.notes?.includes('Test 1 Road'))).toBe(true);
    neighbourhood.segments.forEach((s) => expect(s.notes ?? '').not.toMatch(/jalan|lorong/i));
  });

  test('with a station mapped, every walk starts at public transport and no home clusters are made', () => {
    const { neighbourhood, journeys } = buildArea({
      area: MINI_AREA,
      elements: miniAreaElements({ withStation: true }),
      unitCosts,
      fetchedAt: '2026-10-15',
    });
    const kindOf = new Map(neighbourhood.destinations.map((d) => [d.id, d.kind]));
    expect(journeys.length).toBeGreaterThanOrEqual(4);
    journeys.forEach((j) => expect(['rail-station', 'bus-stop']).toContain(kindOf.get(j.originId)));
    expect(neighbourhood.destinations.some((d) => d.kind === 'home')).toBe(false);
    const station = neighbourhood.destinations.find((d) => d.kind === 'rail-station');
    expect(station).toMatchObject({ name: 'LRT station', localName: 'Stesen Ujian' });
    const fromStation = journeys.filter((j) => j.originId === station!.id);
    const fromBus = journeys.filter((j) => kindOf.get(j.originId) === 'bus-stop');
    const busiest = (list: typeof journeys) => Math.max(0, ...list.map((j) => j.dailyTrips));
    expect(busiest(fromStation)).toBeGreaterThan(busiest(fromBus));
  });

  test('with too few transit walks, home clusters top up the trips', () => {
    const { neighbourhood, journeys } = build();
    const kindOf = new Map(neighbourhood.destinations.map((d) => [d.id, d.kind]));
    expect(journeys.some((j) => kindOf.get(j.originId) === 'bus-stop')).toBe(true);
    expect(journeys.some((j) => kindOf.get(j.originId) === 'home')).toBe(true);
  });

  test('refuses an area with no homes and too little transit, with a helpful message', () => {
    const sparse = () =>
      buildArea({ area: MINI_AREA, elements: miniAreaElements({ withHouses: false }), unitCosts, fetchedAt: '2026-10-15' });
    expect(sparse).toThrow(AreaTooSparseError);
    expect(sparse).toThrow(/bus stops, stations, homes, shops or shophouse rows/);
  });

  test('refuses an area with almost no paths', () => {
    expect(() => buildArea({ area: MINI_AREA, elements: [], unitCosts, fetchedAt: '2026-10-15' })).toThrow(/walkable paths/);
  });
});

describe('analysePlace (look up any place)', () => {
  const place = { id: '1', name: 'Testville', detail: 'Nowhere', lat: 3.1, lng: 101.6, countryCode: 'my' };
  const retry = { maxAttempts: 1, baseWaitMs: 0 };

  test('downloads, builds, saves, and returns a loadable custom area id', async () => {
    const storage = new MemoryStorage();
    const messages: string[] = [];
    const id = await analysePlace(place, (m) => messages.push(m), {
      fetchImpl: async () => json({ elements: miniAreaElements() }),
      storage,
      retry,
    });
    expect(id).toBe(`custom:${slugFor(place)}`);
    expect(messages[0]).toMatch(/Downloading/);
    expect(messages.join(' ')).toMatch(/shade/);
    const saved = loadCustomArea(slugFor(place), storage)!;
    expect(parseDataset({ ...saved, unitCosts }).neighbourhood.meta!.name).toBe('Testville');
  });

  test('explains an unusable area in plain English', async () => {
    await expect(
      analysePlace(place, () => undefined, { fetchImpl: async () => json({ elements: [] }), storage: new MemoryStorage(), retry }),
    ).rejects.toThrow(/walkable paths/);
  });

  test('explains a download failure', async () => {
    const failing = analysePlace(place, () => undefined, {
      fetchImpl: async () => json({}, 502),
      storage: new MemoryStorage(),
      retry,
    });
    await expect(failing).rejects.toThrow(AnalyseError);
    await expect(failing).rejects.toThrow(/internet/);
  });

  test('explains when the browser cannot store the result', async () => {
    await expect(
      analysePlace(place, () => undefined, {
        fetchImpl: async () => json({ elements: miniAreaElements() }),
        storage: new MemoryStorage(10),
        retry,
      }),
    ).rejects.toThrow(/store/);
  });

  test('slugFor is URL-safe and stable', () => {
    expect(slugFor({ name: 'Taman Tun Dr. Ismail!', lat: 3.1396, lng: 101.6297 })).toBe('taman-tun-dr-ismail-3140-101630');
  });
});

describe('overpass fetching', () => {
  test('retries across servers until one answers with JSON', async () => {
    const calls: string[] = [];
    const result = await fetchOverpass(
      MINI_AREA,
      () => undefined,
      async (url) => {
        calls.push(url);
        return calls.length < 3 ? new Response('busy', { status: 502 }) : json({ elements: [1] });
      },
      { maxAttempts: 5, baseWaitMs: 0 },
    );
    expect(result).toEqual({ elements: [1] });
    expect(new Set(calls).size).toBe(3);
  });

  test('gives up with a clear error after the attempt limit', async () => {
    await expect(
      fetchOverpass(MINI_AREA, () => undefined, async () => new Response('x', { status: 500 }), { maxAttempts: 2, baseWaitMs: 0 }),
    ).rejects.toThrow(/Overpass/);
  });
});
