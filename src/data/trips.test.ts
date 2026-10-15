import { describe, expect, test } from 'vitest';
import {
  estimateTrips,
  mergeNearby,
  nameDestinations,
  placeFromTags,
  selectJourneys,
  type Place,
  type TripCandidate,
} from '../../data/osm/trips';

const place = (over: Partial<Place> & Pick<Place, 'id' | 'kind' | 'role'>): Place => ({
  label: over.kind,
  nodeId: `n-${over.id}`,
  xy: [0, 0],
  weight: 1,
  ...over,
});

describe('what counts as public transport and as a place people walk to', () => {
  test('rail stations are transit, named by the kind of line', () => {
    expect(placeFromTags({ railway: 'station', station: 'light_rail' })).toMatchObject({
      role: 'transit',
      kind: 'rail-station',
      label: 'LRT station',
    });
    expect(placeFromTags({ public_transport: 'station', station: 'subway' })?.label).toBe('MRT station');
    expect(placeFromTags({ railway: 'station' })?.label).toBe('Train station');
    expect(placeFromTags({ highway: 'bus_stop' })).toMatchObject({ role: 'transit', kind: 'bus-stop' });
  });

  test('a station outweighs a bus stop, and a mall outweighs a corner shop', () => {
    const station = placeFromTags({ railway: 'station', station: 'subway' })!;
    const bus = placeFromTags({ highway: 'bus_stop' })!;
    const mall = placeFromTags({ shop: 'mall' })!;
    const supermarket = placeFromTags({ shop: 'supermarket' })!;
    expect(station.weight).toBeGreaterThan(bus.weight);
    expect(mall).toMatchObject({ role: 'attractor', kind: 'mall', label: 'Shopping mall' });
    expect(mall.weight).toBeGreaterThan(supermarket.weight);
  });

  test('schools, clinics, markets and places of worship are attractors; small shops and pharmacies are not', () => {
    expect(placeFromTags({ amenity: 'school' })).toMatchObject({ role: 'attractor', kind: 'school' });
    expect(placeFromTags({ amenity: 'hospital' })).toMatchObject({ kind: 'clinic', label: 'Hospital' });
    expect(placeFromTags({ amenity: 'marketplace' })).toMatchObject({ kind: 'shops', label: 'Market' });
    expect(placeFromTags({ amenity: 'place_of_worship', religion: 'muslim' })).toMatchObject({
      kind: 'worship',
      label: 'Mosque',
    });
    expect(placeFromTags({ shop: 'convenience' })).toBeNull();
    expect(placeFromTags({ amenity: 'pharmacy' })).toBeNull();
    expect(placeFromTags({ amenity: 'kindergarten' })).toBeNull();
  });
});

describe('estimateTrips', () => {
  test('grows with the size of both places and falls with walking distance', () => {
    expect(estimateTrips(10, 8, 400)).toBeGreaterThan(estimateTrips(1, 8, 400));
    expect(estimateTrips(1, 8, 400)).toBeGreaterThan(estimateTrips(1, 3, 400));
    expect(estimateTrips(1, 8, 300)).toBeGreaterThan(estimateTrips(1, 8, 900));
  });

  test('is a whole number with a small floor, so every modelled walk counts a little', () => {
    const trips = estimateTrips(1, 1.5, 990);
    expect(Number.isInteger(trips)).toBe(true);
    expect(trips).toBeGreaterThanOrEqual(10);
  });
});

describe('mergeNearby', () => {
  test('bus stops on opposite sides of a road become one stop that counts both', () => {
    const merged = mergeNearby([
      place({ id: 'a', kind: 'bus-stop', role: 'transit', xy: [0, 0] }),
      place({ id: 'b', kind: 'bus-stop', role: 'transit', xy: [25, 0] }),
      place({ id: 'c', kind: 'bus-stop', role: 'transit', xy: [500, 0] }),
    ]);
    expect(merged.map((p) => p.id)).toEqual(['a', 'c']);
    expect(merged[0]!.weight).toBe(2);
  });

  test('a station mapped as several points is one station', () => {
    const station = { kind: 'rail-station' as const, role: 'transit' as const, weight: 10 };
    const merged = mergeNearby([
      place({ ...station, id: 's1', xy: [0, 0] }),
      place({ ...station, id: 's2', xy: [60, 40] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.weight).toBe(10);
  });

  test('a school mapped as both a point and its grounds is one school', () => {
    const school = { kind: 'school' as const, role: 'attractor' as const, weight: 5 };
    const merged = mergeNearby([
      place({ ...school, id: 'node', xy: [0, 0] }),
      place({ ...school, id: 'grounds', xy: [150, 60] }),
      place({ ...school, id: 'other', xy: [600, 0] }),
    ]);
    expect(merged.map((p) => p.id)).toEqual(['node', 'other']);
  });

  test('different kinds of place are never merged', () => {
    const merged = mergeNearby([
      place({ id: 'bus', kind: 'bus-stop', role: 'transit', xy: [0, 0] }),
      place({ id: 'mall', kind: 'mall', role: 'attractor', xy: [10, 0], weight: 8 }),
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('selectJourneys', () => {
  const trip = (originId: string, destinationId: string, destinationKind: Place['kind'], trips: number): TripCandidate => ({
    originId,
    destinationId,
    destinationKind,
    walkM: 500,
    trips,
  });

  test('keeps the busiest walks first, but covers every kind of destination', () => {
    const chosen = selectJourneys(
      [
        trip('station', 'mall', 'mall', 400),
        trip('station', 'market', 'shops', 300),
        trip('bus', 'mall', 'mall', 50),
        trip('bus', 'school', 'school', 20),
      ],
      { maxJourneys: 3, maxPerDestination: 2, maxPerOrigin: 4, maxPlaces: 9 },
    );
    expect(chosen.map((c) => c.destinationId)).toEqual(['mall', 'market', 'school']);
  });

  test('caps how many walks share one origin or one destination', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((d, i) => trip('station', d, 'school', 100 - i));
    const chosen = selectJourneys(many, { maxJourneys: 10, maxPerDestination: 2, maxPerOrigin: 3, maxPlaces: 9 });
    expect(chosen).toHaveLength(3);
  });

  test('never uses more distinct places than the map can label', () => {
    const many = Array.from({ length: 8 }, (_, i) => trip(`o${i}`, `d${i}`, 'school', 100 - i));
    const chosen = selectJourneys(many, { maxJourneys: 10, maxPerDestination: 2, maxPerOrigin: 4, maxPlaces: 6 });
    const places = new Set(chosen.flatMap((c) => [c.originId, c.destinationId]));
    expect(places.size).toBeLessThanOrEqual(6);
  });
});

describe('nameDestinations', () => {
  test('keeps unique labels and adds a compass side only where two places share a label', () => {
    const names = nameDestinations(
      [
        place({ id: 'b1', kind: 'bus-stop', role: 'transit', label: 'Bus stop', xy: [100, 100] }),
        place({ id: 'b2', kind: 'bus-stop', role: 'transit', label: 'Bus stop', xy: [-100, -100] }),
        place({ id: 'm', kind: 'mall', role: 'attractor', label: 'Shopping mall' }),
      ],
      [0, 0],
    );
    expect(names.get('b1')).toBe('Bus stop (north-east)');
    expect(names.get('b2')).toBe('Bus stop (south-west)');
    expect(names.get('m')).toBe('Shopping mall');
  });

  test('prefers the street name for repeats, and falls back to the compass side', () => {
    const streets = new Map([['n-b1', 'Majlis Road'], ['n-b2', 'SS 4A/2 Road']]);
    const names = nameDestinations(
      [
        place({ id: 'b1', kind: 'bus-stop', role: 'transit', label: 'Bus stop', xy: [0, -100] }),
        place({ id: 'b2', kind: 'bus-stop', role: 'transit', label: 'Bus stop', xy: [0, -200] }),
        place({ id: 'b3', kind: 'bus-stop', role: 'transit', label: 'Bus stop', xy: [100, 0] }),
      ],
      [0, 0],
      (nodeId) => streets.get(nodeId),
    );
    expect([...names.values()]).toEqual(['Bus stop on Majlis Road', 'Bus stop on SS 4A/2 Road', 'Bus stop (east)']);
  });

  test('home clusters are named by side of the area, never by one street', () => {
    const names = nameDestinations(
      [
        place({ id: 'h1', kind: 'home', role: 'homes', label: 'Homes', xy: [100, 0] }),
        place({ id: 'h2', kind: 'home', role: 'homes', label: 'Homes', xy: [-100, 0] }),
      ],
      [0, 0],
      () => 'Putra 2 Road',
    );
    expect([...names.values()]).toEqual(['Homes (east)', 'Homes (west)']);
  });

  test('two repeats on the same street still get distinct names', () => {
    const names = nameDestinations(
      [
        place({ id: 'b1', kind: 'bus-stop', role: 'transit', label: 'Bus stop', xy: [0, -100] }),
        place({ id: 'b2', kind: 'bus-stop', role: 'transit', label: 'Bus stop', xy: [0, -300] }),
      ],
      [0, 0],
      () => 'Majlis Road',
    );
    expect(new Set(names.values()).size).toBe(2);
  });
});
