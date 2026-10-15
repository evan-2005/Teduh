import { describe, expect, test } from 'vitest';
import { dataset, graph } from '../data/dataset';
import { compareJourney } from './compare';
import { buildGraph } from './graph';
import { buildShadeLookup } from './shade';
import { fiveNodeNodes, fiveNodeSegments } from './testGraph';

const { neighbourhood, journeys } = dataset;
const params = {
  time: '14:00' as const,
  canopy: 'now' as const,
  canopyYear: 0,
  interventions: [],
  overrides: [],
};
const shade = buildShadeLookup(neighbourhood.segments, params);
const journey = journeys.find((j) => j.id === 'j-home-a-shops')!;

describe('compareJourney', () => {
  test('least-sun route has no more sun than shortest and stays within the detour limit', () => {
    const result = compareJourney(graph, journey, neighbourhood.destinations, shade, 0.25)!;
    expect(result.leastSun.sunMin).toBeLessThanOrEqual(result.shortest.sunMin);
    expect(result.leastSun.lengthM).toBeLessThanOrEqual(result.shortest.lengthM * 1.25);
  });

  test('seed Home A → shops: the two routes differ at 14:00', () => {
    const result = compareJourney(graph, journey, neighbourhood.destinations, shade, 0.25)!;
    expect(result.leastSun.segmentIds).not.toEqual(result.shortest.segmentIds);
    expect(result.leastSun.sunMin).toBeLessThan(result.shortest.sunMin);
  });

  test('with a 0 detour limit both routes are the same length', () => {
    const result = compareJourney(graph, journey, neighbourhood.destinations, shade, 0)!;
    expect(result.leastSun.lengthM).toBeCloseTo(result.shortest.lengthM);
  });

  test('returns null for an unknown destination', () => {
    const bad = { ...journey, destinationId: 'nope' };
    expect(compareJourney(graph, bad, neighbourhood.destinations, shade, 0.25)).toBeNull();
  });

  test('returns null when the pair is unreachable', () => {
    const isolated = buildGraph(fiveNodeNodes, fiveNodeSegments().slice(0, 2));
    const destinations = [
      { id: 'o', nodeId: 'A', name: 'O', kind: 'home' as const },
      { id: 'd', nodeId: 'D', name: 'D', kind: 'shops' as const },
    ];
    const trip = { ...journey, originId: 'o', destinationId: 'd' };
    expect(compareJourney(isolated, trip, destinations, new Map(), 0.25)).toBeNull();
  });
});
