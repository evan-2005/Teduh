import { describe, expect, test } from 'vitest';
import { WALK_SPEED_M_PER_MIN } from '../config';
import { buildGraph } from './graph';
import { longestExposedM, routeResult, sunMin, walkMin } from './metrics';
import { fiveNodeNodes, fiveNodeSegments } from './testGraph';

const span = (lengthM: number, shade: number) => ({ lengthM, shade });

describe('walkMin / sunMin', () => {
  test('walkMin is total length over walk speed', () => {
    expect(walkMin([span(72, 0), span(72, 1)])).toBeCloseTo(2);
    expect(WALK_SPEED_M_PER_MIN).toBe(72);
  });

  test('sunMin weights each segment by its unshaded fraction', () => {
    expect(sunMin([span(72, 0), span(72, 1), span(72, 0.5)])).toBeCloseTo(1.5);
  });

  test('empty route is zero', () => {
    expect(walkMin([])).toBe(0);
    expect(sunMin([])).toBe(0);
  });
});

describe('longestExposedM', () => {
  test('is 0 for an empty route', () => {
    expect(longestExposedM([])).toBe(0);
  });

  test('is 0 when everything is shaded', () => {
    expect(longestExposedM([span(50, 0.9), span(50, 0.5)])).toBe(0);
  });

  test('sums the whole route when everything is exposed', () => {
    expect(longestExposedM([span(50, 0), span(70, 0.49)])).toBe(120);
  });

  test('picks the longest run, resetting on shaded segments', () => {
    const spans = [span(40, 0), span(30, 0.1), span(10, 0.9), span(100, 0.2), span(5, 0.4)];
    expect(longestExposedM(spans)).toBe(105);
  });
});

describe('routeResult', () => {
  test('computes all metrics along a route', () => {
    const graph = buildGraph(fiveNodeNodes, fiveNodeSegments());
    const shade = new Map([['ab', 0], ['be', 1]]);
    const result = routeResult('j1', { segmentIds: ['ab', 'be'], lengthM: 200 }, graph, shade);
    expect(result.journeyId).toBe('j1');
    expect(result.lengthM).toBe(200);
    expect(result.walkMin).toBeCloseTo(200 / 72);
    expect(result.sunMin).toBeCloseTo(100 / 72);
    expect(result.longestExposedM).toBe(100);
  });
});
