import { describe, expect, test } from 'vitest';
import neighbourhoodRaw from '../../data/seed/neighbourhood.json';
import interventionsRaw from '../../data/seed/interventions.json';
import journeysRaw from '../../data/seed/journeys.json';
import unitCostsRaw from '../../data/unit-costs.json';
import { loadDataset, parseDataset } from './load';

const raw = {
  neighbourhood: neighbourhoodRaw,
  journeys: journeysRaw,
  interventions: interventionsRaw,
  unitCosts: unitCostsRaw,
};

describe('seed dataset', () => {
  test('loads and satisfies the Phase 0 spec', async () => {
    const data = await loadDataset('seed');
    expect(data.neighbourhood.segments.length).toBeGreaterThanOrEqual(20);
    expect(data.neighbourhood.segments.length).toBeLessThanOrEqual(40);
    expect(data.neighbourhood.destinations).toHaveLength(5);
    expect(data.journeys).toHaveLength(6);
    expect(data.interventions).toHaveLength(8);
    expect(data.interventions.filter((i) => i.type === 'shelter')).toHaveLength(3);
  });
});

describe('dataset validation', () => {
  test('rejects a shade value outside 0..1', () => {
    const bad = structuredClone(raw);
    bad.neighbourhood.segments[0]!.shade['14:00'] = 1.4;
    expect(() => parseDataset(bad)).toThrow();
  });

  test('rejects a segment that references an unknown node', () => {
    const bad = structuredClone(raw);
    bad.neighbourhood.segments[0]!.to = 'n-missing';
    expect(() => parseDataset(bad)).toThrow(/unknown node n-missing/);
  });

  test('rejects an intervention that references an unknown segment', () => {
    const bad = structuredClone(raw);
    bad.interventions[0]!.segmentIds = ['seg-nope'];
    expect(() => parseDataset(bad)).toThrow(/unknown segment seg-nope/);
  });

  test('accepts a journey that starts at public transport rather than a home', () => {
    const ok = structuredClone(raw);
    ok.journeys[0]!.originId = 'dest-bus';
    expect(() => parseDataset(ok)).not.toThrow();
  });

  test('rejects a journey from an unknown place, or from a place to itself', () => {
    const unknown = structuredClone(raw);
    unknown.journeys[0]!.originId = 'dest-nope';
    expect(() => parseDataset(unknown)).toThrow(/unknown origin dest-nope/);
    const loop = structuredClone(raw);
    loop.journeys[0]!.originId = loop.journeys[0]!.destinationId;
    expect(() => parseDataset(loop)).toThrow(/starts and ends at the same place/);
  });
});
