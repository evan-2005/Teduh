import { describe, expect, test } from 'vitest';
import type { Intervention } from '../types';
import { buildShadeLookup, effectiveShade, interventionShade, type ShadeParams } from './shade';
import { makeSegment } from './testGraph';

const tree: Intervention = {
  id: 'tree',
  type: 'tree',
  name: 'Tree',
  segmentIds: ['s'],
  installCost: 1000,
  annualMaintenance: 100,
  shadeNow: 0.2,
  shadeFuture: 0.8,
  yearsToMature: 6,
  feasibility: 'approved',
  costSource: 'estimated',
};
const shelter: Intervention = {
  ...tree,
  id: 'shelter',
  type: 'shelter',
  shadeNow: 0.95,
  shadeFuture: 0.95,
  yearsToMature: 0,
};

const segment = makeSegment('s', 'a', 'b', 100, 0.3);
const params = (over: Partial<ShadeParams> = {}): ShadeParams => ({
  time: '14:00',
  canopy: 'now',
  canopyYear: 0,
  interventions: [],
  overrides: [],
  ...over,
});

describe('interventionShade', () => {
  test('uses shadeNow in "now" mode regardless of year', () => {
    expect(interventionShade(tree, 'now', 10)).toBe(0.2);
  });

  test('future mode at year 0 equals shadeNow', () => {
    expect(interventionShade(tree, 'future', 0)).toBeCloseTo(0.2);
  });

  test('future mode at maturity equals shadeFuture', () => {
    expect(interventionShade(tree, 'future', 6)).toBeCloseTo(0.8);
    expect(interventionShade(tree, 'future', 10)).toBeCloseTo(0.8);
  });

  test('future mode grows monotonically between 0 and maturity', () => {
    const mid = interventionShade(tree, 'future', 3);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  test('shelters are unchanged by the canopy toggle', () => {
    expect(interventionShade(shelter, 'future', 5)).toBe(interventionShade(shelter, 'now', 5));
  });
});

describe('effectiveShade', () => {
  test('returns the survey snapshot when nothing is applied', () => {
    expect(effectiveShade(segment, params())).toBe(0.3);
  });

  test('takes the max of base and intervention, never lowers shade', () => {
    expect(effectiveShade(segment, params({ interventions: [tree] }))).toBe(0.3);
    expect(effectiveShade(segment, params({ interventions: [shelter] }))).toBe(0.95);
  });

  test('ignores interventions on other segments', () => {
    const other = { ...shelter, segmentIds: ['elsewhere'] };
    expect(effectiveShade(segment, params({ interventions: [other] }))).toBe(0.3);
  });

  test('an override replaces the survey value for its time only', () => {
    const overrides = [{ segmentId: 's', time: '14:00' as const, shade: 0.7, source: 'ai-confirmed' as const }];
    expect(effectiveShade(segment, params({ overrides }))).toBe(0.7);
    expect(effectiveShade(segment, params({ overrides, time: '09:00' }))).toBe(0.3);
  });

  test('interventions still apply on top of an override', () => {
    const overrides = [{ segmentId: 's', time: '14:00' as const, shade: 0.1, source: 'ai-confirmed' as const }];
    expect(effectiveShade(segment, params({ overrides, interventions: [shelter] }))).toBe(0.95);
  });

  test('future canopy raises tree shade above the baseline', () => {
    const p = params({ interventions: [tree], canopy: 'future', canopyYear: 6 });
    expect(effectiveShade(segment, p)).toBeCloseTo(0.8);
  });
});

describe('buildShadeLookup', () => {
  test('maps every segment id', () => {
    const lookup = buildShadeLookup([segment, makeSegment('t', 'b', 'c', 50, 1)], params());
    expect(lookup.get('s')).toBe(0.3);
    expect(lookup.get('t')).toBe(1);
  });
});
