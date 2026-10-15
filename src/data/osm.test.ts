import { describe, expect, test } from 'vitest';
import {
  centroid,
  createProjection,
  pointAlong,
  pointInPolygon,
  polylineLength,
  rayPolygonHit,
  simplify,
  splitEvenly,
  type XY,
} from '../../data/osm/geometry';
import { uniqueNames } from '../../data/osm/candidates';
import { clusterHomes, compassName } from '../../data/osm/destinations';
import { buildNetwork, DEFAULT_NETWORK_OPTIONS } from '../../data/osm/network';
import {
  buildingHeightM,
  classifyPoi,
  englishStreetName,
  isWalkable,
  parseOsm,
  type Highway,
} from '../../data/osm/parse';
import { BuildingIndex, segmentShade, sunPosition } from '../../data/osm/shade';
import type { Intervention } from '../types';

describe('geometry', () => {
  test('projection round-trips and is metric', () => {
    const proj = createProjection(3.1, 101.6);
    const [x, y] = proj.toXY(3.1009, 101.6);
    expect(x).toBeCloseTo(0, 3);
    expect(y).toBeGreaterThan(99);
    expect(y).toBeLessThan(101);
    const [lat, lng] = proj.toLatLng(x, y);
    expect(lat).toBeCloseTo(3.1009, 6);
    expect(lng).toBeCloseTo(101.6, 6);
  });

  test('simplify drops points on a straight line but keeps corners', () => {
    expect(simplify([[0, 0], [5, 0.1], [10, 0]], 1)).toEqual([[0, 0], [10, 0]]);
    expect(simplify([[0, 0], [5, 8], [10, 0]], 1)).toHaveLength(3);
  });

  test('splitEvenly never exceeds the maximum piece length', () => {
    const pieces = splitEvenly([0, 0], [100, 0], 30);
    expect(pieces).toHaveLength(5);
    expect(polylineLength(pieces)).toBeCloseTo(100);
  });

  test('pointAlong and centroid', () => {
    expect(pointAlong([[0, 0], [10, 0]], 4)).toEqual([4, 0]);
    expect(pointAlong([[0, 0], [10, 0]], 99)).toEqual([10, 0]);
    expect(centroid([[0, 0], [4, 2]])).toEqual([2, 1]);
  });

  const square: XY[] = [[10, -5], [20, -5], [20, 5], [10, 5]];
  test('rayPolygonHit finds the near wall and respects the maximum distance', () => {
    expect(rayPolygonHit([0, 0], [1, 0], square, 50)).toBeCloseTo(10);
    expect(rayPolygonHit([0, 0], [1, 0], square, 5)).toBeNull();
    expect(rayPolygonHit([0, 0], [-1, 0], square, 50)).toBeNull();
  });

  test('pointInPolygon', () => {
    expect(pointInPolygon([15, 0], square)).toBe(true);
    expect(pointInPolygon([0, 0], square)).toBe(false);
  });
});

describe('parse', () => {
  test('translates street types into English', () => {
    expect(englishStreetName('Jalan SS 4C/3')).toBe('SS 4C/3 Road');
    expect(englishStreetName('Lorong Mawar')).toBe('Mawar Lane');
    expect(englishStreetName('Persiaran Bunga')).toBe('Bunga Avenue');
    expect(englishStreetName('Lebuh Raya')).toBe('Raya Street');
    expect(englishStreetName('Majlis Avenue')).toBe('Majlis Avenue');
  });

  test('only keeps ways a person can walk', () => {
    expect(isWalkable({ highway: 'footway' })).toBe(true);
    expect(isWalkable({ highway: 'service', service: 'alley' })).toBe(true);
    expect(isWalkable({ highway: 'service', service: 'driveway' })).toBe(false);
    expect(isWalkable({ highway: 'motorway' })).toBe(false);
    expect(isWalkable({ highway: 'residential', access: 'private' })).toBe(false);
    expect(isWalkable({ highway: 'footway', foot: 'no' })).toBe(false);
  });

  test('building heights come from tags, then levels, then the building type', () => {
    expect(buildingHeightM({ building: 'house', height: '9.5' })).toBe(9.5);
    expect(buildingHeightM({ building: 'house', 'building:levels': '3' })).toBeCloseTo(10.6);
    expect(buildingHeightM({ building: 'retail' })).toBe(10);
    expect(buildingHeightM({ building: 'unknown-type' })).toBe(7);
  });

  test('classifies places with plain English labels', () => {
    expect(classifyPoi({ highway: 'bus_stop' })).toEqual({ landmark: 'bus-stop', label: 'Bus stop' });
    expect(classifyPoi({ amenity: 'school' })?.label).toBe('School');
    expect(classifyPoi({ amenity: 'place_of_worship', religion: 'muslim' })?.label).toBe('Mosque');
    expect(classifyPoi({ shop: 'supermarket' })?.label).toBe('Supermarket');
    expect(classifyPoi({ landuse: 'grass' })).toBeNull();
  });

  test('parseOsm projects ways, buildings, trees and places', () => {
    const proj = createProjection(3.1, 101.6);
    const g = (lat: number, lon: number) => ({ lat, lon });
    const parsed = parseOsm(
      [
        { type: 'way', id: 1, tags: { highway: 'footway' }, geometry: [g(3.1, 101.6), g(3.1, 101.601)] },
        { type: 'way', id: 2, tags: { building: 'house' }, geometry: [g(3.1, 101.6), g(3.1, 101.6001), g(3.1001, 101.6001), g(3.1, 101.6)] },
        { type: 'node', id: 3, lat: 3.1, lon: 101.6, tags: { natural: 'tree' } },
        { type: 'node', id: 4, lat: 3.1, lon: 101.6, tags: { amenity: 'school', name: 'Local School Name' } },
      ],
      proj,
    );
    expect(parsed.highways).toHaveLength(1);
    expect(parsed.buildings).toHaveLength(1);
    expect(parsed.trees).toHaveLength(1);
    expect(parsed.pois[0]).toMatchObject({ label: 'School', landmark: 'school' });
  });
});

describe('network', () => {
  const way = (id: number, points: XY[], tags: Record<string, string> = { highway: 'residential' }): Highway => ({ id, tags, points });
  const options = { ...DEFAULT_NETWORK_OPTIONS, radiusM: 1000 };

  test('collapses straight chains and keeps junctions', () => {
    const net = buildNetwork(
      [
        way(1, [[0, 0], [30, 0], [60, 0], [90, 0]]),
        way(2, [[90, 0], [90, 50], [90, 100]]),
        way(3, [[90, 0], [140, 0], [200, 0]]),
      ],
      options,
    );
    expect(net.segments.length).toBeLessThanOrEqual(6);
    const lengths = net.segments.map((s) => s.lengthM);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(options.maxSegmentM + 0.001);
    expect(lengths.reduce((a, b) => a + b, 0)).toBeCloseTo(90 + 100 + 110, 0);
  });

  test('removes short dead-end stubs and keeps only the largest connected network', () => {
    const net = buildNetwork(
      [
        way(1, [[0, 0], [100, 0], [200, 0]]),
        way(2, [[100, 0], [100, 8]]),
        way(3, [[500, 500], [520, 500]]),
      ],
      options,
    );
    expect(net.segments.every((s) => s.lengthM > 20)).toBe(true);
    expect(net.nodes.every((n) => n.xy[0] < 300)).toBe(true);
  });

  test('marks covered walkways and translates names', () => {
    const net = buildNetwork(
      [way(1, [[0, 0], [60, 0]], { highway: 'footway', covered: 'yes', name: 'Jalan Satu' })],
      options,
    );
    expect(net.segments[0]).toMatchObject({ covered: true, name: 'Satu Road', widthM: 1.8 });
  });

  test('drops edges outside the radius', () => {
    const net = buildNetwork([way(1, [[0, 0], [100, 0]]), way(2, [[100, 0], [900, 0]])], { ...options, radiusM: 300 });
    expect(net.segments.length).toBeGreaterThan(0);
    expect(net.nodes.every((n) => Math.hypot(...n.xy) <= 300)).toBe(true);
  });
});

describe('sun and shade', () => {
  test('near the equator the sun is almost overhead at noon and low at 09:00 and 17:00', () => {
    const noon = sunPosition(3.1, 101.6, 288, 12);
    const morning = sunPosition(3.1, 101.6, 288, 9);
    const evening = sunPosition(3.1, 101.6, 288, 17);
    expect(noon.elevation * (180 / Math.PI)).toBeGreaterThan(70);
    expect(morning.elevation * (180 / Math.PI)).toBeLessThan(45);
    expect(morning.direction[0]).toBeGreaterThan(0.5); // east
    expect(evening.direction[0]).toBeLessThan(-0.5); // west
  });

  const wall = { id: 1, kind: 'house', heightM: 8, ring: [[6, -50], [12, -50], [12, 50], [6, 50]] as XY[] };
  const casters = { buildings: new BuildingIndex([wall]), trees: [] as XY[] };
  const lowEastSun = { elevation: (30 * Math.PI) / 180, direction: [1, 0] as XY };

  test('a tall wall to the east shades a path in the morning', () => {
    expect(segmentShade([0, -20], [0, 20], false, lowEastSun, casters)).toBeGreaterThan(0.9);
  });

  test('the same wall casts nothing when the sun is nearly overhead', () => {
    const high = { elevation: (80 * Math.PI) / 180, direction: [1, 0] as XY };
    expect(segmentShade([0, -20], [0, 20], false, high, casters)).toBe(0);
  });

  test('a wall on the far side of the sun does not shade the path', () => {
    const westSun = { ...lowEastSun, direction: [-1, 0] as XY };
    expect(segmentShade([0, -20], [0, 20], false, westSun, casters)).toBe(0);
  });

  test('covered walkways are shaded all day, and night-time sun gives none', () => {
    expect(segmentShade([0, 0], [10, 0], true, null, casters)).toBe(0.95);
    expect(segmentShade([0, 0], [10, 0], false, null, casters)).toBe(0);
  });

  test('a mapped tree shades the path beneath its crown', () => {
    const treeCasters = { buildings: new BuildingIndex([]), trees: [[0, 0]] as XY[] };
    const high = { elevation: (85 * Math.PI) / 180, direction: [0, 1] as XY };
    expect(segmentShade([-1, 0], [1, 0], false, high, treeCasters)).toBeGreaterThan(0.9);
    expect(segmentShade([30, 0], [40, 0], false, high, treeCasters)).toBe(0);
  });
});

describe('destinations and candidates', () => {
  test('compassName', () => {
    expect(compassName(10, 0)).toBe('east');
    expect(compassName(0, 10)).toBe('north');
    expect(compassName(-10, -10)).toBe('south-west');
  });

  test('clusterHomes splits two well-separated groups', () => {
    const house = (x: number, y: number, id: number) => ({
      id, kind: 'house', heightM: 7, ring: [[x, y], [x + 5, y], [x + 5, y + 5], [x, y + 5]] as XY[],
    });
    const west = [house(0, 0, 1), house(10, 0, 2), house(0, 10, 3)];
    const east = [house(300, 0, 4), house(310, 0, 5)];
    const clusters = clusterHomes([...west, ...east]);
    expect(clusters.map((c) => c.size).sort()).toEqual([2, 3]);
  });

  test('uniqueNames adds letters only to duplicates', () => {
    const item = (id: string, name: string) => ({ id, name }) as Intervention;
    const named = uniqueNames([item('a', 'Same'), item('b', 'Same'), item('c', 'Other')]);
    expect(named.map((i) => i.name)).toEqual(['Same – A', 'Same – B', 'Other']);
  });
});
