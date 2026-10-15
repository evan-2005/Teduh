import { describe, expect, test } from 'vitest';
import { loadDataset } from '../data/load';
import { buildGraph } from './graph';
import { routeResult } from './metrics';
import { leastSunRoute, shortestRoute } from './routing';
import { buildShadeLookup } from './shade';
import { fiveNodeNodes, fiveNodeSegments } from './testGraph';

const graph = buildGraph(fiveNodeNodes, fiveNodeSegments());
const shadeOf = (segments = fiveNodeSegments()) =>
  new Map(segments.map((s) => [s.id, s.shade['14:00']]));

describe('buildGraph', () => {
  test('excludes inaccessible segments from adjacency but keeps their length', () => {
    const blocked = buildGraph(fiveNodeNodes, fiveNodeSegments(false));
    expect(blocked.adjacency.get('C')).toEqual([]);
    expect(blocked.lengthBySegment.get('ac')).toBe(100);
  });
});

describe('shortestRoute', () => {
  test('finds the 200 m direct route on the 5-node graph', () => {
    const route = shortestRoute(graph, 'A', 'E');
    expect(route).toEqual({ segmentIds: ['ab', 'be'], lengthM: 200 });
  });

  test('works in both directions (undirected)', () => {
    expect(shortestRoute(graph, 'E', 'A')?.segmentIds).toEqual(['be', 'ab']);
  });

  test('returns an empty route when origin equals destination', () => {
    expect(shortestRoute(graph, 'A', 'A')).toEqual({ segmentIds: [], lengthM: 0 });
  });

  test('returns null when the destination is unreachable', () => {
    const isolated = buildGraph(fiveNodeNodes, fiveNodeSegments().slice(0, 2));
    expect(shortestRoute(isolated, 'A', 'D')).toBeNull();
  });
});

describe('leastSunRoute', () => {
  test('takes the shadier route when it is within the detour limit', () => {
    const route = leastSunRoute(graph, 'A', 'E', shadeOf(), 0.25);
    expect(route?.segmentIds).toEqual(['ac', 'cd', 'de']);
    expect(route!.lengthM).toBeLessThanOrEqual(200 * 1.25);
  });

  test('respects the detour limit: falls back to shortest when shade is too far', () => {
    const route = leastSunRoute(graph, 'A', 'E', shadeOf(), 0.1);
    expect(route?.segmentIds).toEqual(['ab', 'be']);
  });

  test('a limit of 0 equals the shortest route', () => {
    const route = leastSunRoute(graph, 'A', 'E', shadeOf(), 0);
    expect(route).toEqual(shortestRoute(graph, 'A', 'E'));
  });

  test('prefers the shortest route when there is no shade difference', () => {
    const flat = new Map(fiveNodeSegments().map((s) => [s.id, 0.5]));
    expect(leastSunRoute(graph, 'A', 'E', flat, 0.5)?.segmentIds).toEqual(['ab', 'be']);
  });

  test('returns null when unreachable', () => {
    const isolated = buildGraph(fiveNodeNodes, fiveNodeSegments().slice(0, 2));
    expect(leastSunRoute(isolated, 'A', 'D', new Map(), 0.25)).toBeNull();
  });

  test('treats missing shade entries as fully exposed', () => {
    const route = leastSunRoute(graph, 'A', 'E', new Map(), 0.25);
    expect(route?.segmentIds).toEqual(['ab', 'be']);
  });
});

const seed = await loadDataset('seed');

describe('seed neighbourhood', () => {
  const { neighbourhood, journeys, interventions } = seed;
  const seedGraph = buildGraph(neighbourhood.nodes, neighbourhood.segments);
  const nodeOf = (destinationId: string) =>
    neighbourhood.destinations.find((d) => d.id === destinationId)!.nodeId;
  const baseParams = {
    time: '14:00' as const,
    canopy: 'now' as const,
    canopyYear: 0,
    overrides: [],
  };

  test('every journey routes through the exposed connector before any intervention', () => {
    const shade = buildShadeLookup(neighbourhood.segments, { ...baseParams, interventions: [] });
    for (const j of journeys) {
      const route = leastSunRoute(seedGraph, nodeOf(j.originId), nodeOf(j.destinationId), shade, 0.25)!;
      expect(route.segmentIds, j.id).toContain('seg-connector-2');
    }
  });

  test('the connector shelter cuts Home A → shops sun-minutes and exposed stretch', () => {
    const journey = journeys.find((j) => j.id === 'j-home-a-shops')!;
    const from = nodeOf(journey.originId);
    const to = nodeOf(journey.destinationId);
    const shelter = interventions.filter((i) => i.id === 'shelter-connector');
    const run = (applied: typeof shelter) => {
      const shade = buildShadeLookup(neighbourhood.segments, { ...baseParams, interventions: applied });
      return routeResult(journey.id, leastSunRoute(seedGraph, from, to, shade, 0.25)!, seedGraph, shade);
    };
    const before = run([]);
    const after = run(shelter);
    expect(before.longestExposedM).toBeCloseTo(240, -1);
    expect(after.longestExposedM).toBeCloseTo(60, -1);
    expect(after.sunMin).toBeLessThan(before.sunMin / 2);
  });
});
