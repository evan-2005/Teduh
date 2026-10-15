import { describe, expect, test } from 'vitest';
import { dataset, graph } from '../data/dataset';
import { createEvaluator, pedestrianSunMinutesAvoided, type OptimizerInput } from './optimizer';

const { neighbourhood, journeys, interventions } = dataset;

const input = (over: Partial<OptimizerInput> = {}): OptimizerInput => ({
  graph,
  segments: neighbourhood.segments,
  destinations: neighbourhood.destinations,
  journeys,
  candidates: interventions,
  time: '14:00',
  canopy: 'now',
  canopyYear: 0,
  detourLimit: 0.25,
  priorityWeights: {},
  overrides: [],
  ...over,
});

const costOf = (ids: readonly string[]) =>
  interventions.filter((i) => ids.includes(i.id)).reduce((s, i) => s + i.installCost, 0);

describe('recommend', () => {
  test('returns at most 3 plans, best first, all within budget', () => {
    const plans = createEvaluator(input()).recommend(25_000);
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.length).toBeLessThanOrEqual(3);
    plans.forEach((p) => expect(p.installCost).toBeLessThanOrEqual(25_000));
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i - 1]!.sunMinutesAvoidedPerDay).toBeGreaterThanOrEqual(
        plans[i]!.sunMinutesAvoidedPerDay,
      );
    }
  });

  test('seed scenario: the shared-connector shelter is the top recommendation at a modest budget', () => {
    const [best] = createEvaluator(input()).recommend(18_000);
    expect(best?.interventionIds).toEqual(['shelter-connector']);
    expect(best?.journeysImproved).toHaveLength(journeys.length);
  });

  test('at RM 25k the best plan includes the connector shelter', () => {
    const [best] = createEvaluator(input()).recommend(25_000);
    expect(best?.interventionIds).toContain('shelter-connector');
  });

  test('never exceeds the budget and returns nothing when nothing is affordable', () => {
    const evaluator = createEvaluator(input());
    for (const budget of [0, 1_000, 6_500, 12_000, 40_000]) {
      evaluator.recommend(budget).forEach((p) => expect(p.installCost).toBeLessThanOrEqual(budget));
    }
    expect(evaluator.recommend(0)).toEqual([]);
  });

  test('plans contain no dead weight: every member contributes', () => {
    for (const plan of createEvaluator(input()).recommend(40_000)) {
      for (const id of plan.interventionIds) {
        expect(plan.contributions[id], id).toBeGreaterThan(0);
      }
    }
  });

  test('priority weights change the winner between bus and school shelters', () => {
    const shelters = interventions.filter((i) => i.type === 'shelter');
    const run = (priorityWeights: Record<string, number>) =>
      createEvaluator(input({ candidates: shelters, priorityWeights })).recommend(7_500)[0]!;
    expect(run({}).interventionIds).toEqual(['shelter-school']);
    expect(run({ 'dest-bus': 5 }).interventionIds).toEqual(['shelter-bus']);
  });

  test('young trees add nothing where shade is already higher, but matter at maturity', () => {
    expect(createEvaluator(input()).recommend(2_000)).toEqual([]);
    const future = createEvaluator(input({ canopy: 'future', canopyYear: 10 })).recommend(2_000);
    expect(future.length).toBeGreaterThan(0);
    future.forEach((p) => p.interventionIds.forEach((id) => expect(id).toMatch(/^tree-/)));
  });

  test('alternatives are real trade-offs: each one is cheaper than every plan ranked above it', () => {
    for (const budget of [12_000, 25_000, 40_000]) {
      const plans = createEvaluator(input()).recommend(budget);
      for (let i = 1; i < plans.length; i++) {
        expect(plans[i]!.installCost, `budget ${budget}`).toBeLessThan(plans[i - 1]!.installCost);
      }
    }
  });

  test('an interchangeable copy of a candidate never shows up as a separate option', () => {
    const connector = interventions.find((i) => i.id === 'shelter-connector')!;
    const copy = { ...connector, id: 'shelter-connector-copy', name: `${connector.name} (copy)` };
    const plans = createEvaluator(input({ candidates: [...interventions, copy] })).recommend(40_000);
    const signature = (ids: readonly string[]) =>
      ids.map((id) => (id === copy.id ? connector.id : id)).sort().join('|');
    const signatures = plans.map((p) => signature(p.interventionIds));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  test('rejects more candidates than MAX_CANDIDATES', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ ...interventions[0]!, id: `c${i}` }));
    expect(() => createEvaluator(input({ candidates: many }))).toThrow(/Too many candidates/);
  });

  test('evaluates all 8 candidates quickly', () => {
    const start = performance.now();
    createEvaluator(input()).recommend(1_000_000);
    expect(performance.now() - start).toBeLessThan(1_500);
  });
});

describe('plan', () => {
  test('empty selection changes nothing', () => {
    const plan = createEvaluator(input()).plan([]);
    expect(plan.sunMinutesAvoidedPerDay).toBe(0);
    expect(plan.installCost).toBe(0);
    expect(plan.journeysImproved).toEqual([]);
  });

  test('sums install cost and upkeep of the selection', () => {
    const ids = ['shelter-connector', 'shelter-school'];
    const plan = createEvaluator(input()).plan(ids);
    expect(plan.installCost).toBe(costOf(ids));
    expect(plan.annualMaintenance).toBe(450 + 160);
  });

  test('overlapping interventions are counted once', () => {
    const evaluator = createEvaluator(input({ canopy: 'future', canopyYear: 10 }));
    const shelterOnly = evaluator.plan(['shelter-connector']);
    const both = evaluator.plan(['shelter-connector', 'tree-connector-mid']);
    expect(both.sunMinutesAvoidedPerDay).toBeCloseTo(shelterOnly.sunMinutesAvoidedPerDay, 6);
    expect(both.contributions['tree-connector-mid']).toBeCloseTo(0, 6);
  });

  test('contributions of independent interventions sum to the plan total', () => {
    const plan = createEvaluator(input()).plan(['shelter-connector', 'shelter-school']);
    const total = Object.values(plan.contributions).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(plan.sunMinutesAvoidedPerDay, 6);
    expect(plan.contributions['shelter-connector']).toBeGreaterThan(plan.contributions['shelter-school']!);
  });

  test('unknown ids are ignored', () => {
    expect(createEvaluator(input()).plan(['nope']).installCost).toBe(0);
  });
});

describe('pedestrianSunMinutesAvoided', () => {
  test('is unweighted by priorities', () => {
    const plain = createEvaluator(input()).plan(['shelter-connector']);
    const weighted = createEvaluator(input({ priorityWeights: { 'dest-shops': 4 } })).plan([
      'shelter-connector',
    ]);
    expect(weighted.sunMinutesAvoidedPerDay).toBeGreaterThan(plain.sunMinutesAvoidedPerDay);
    expect(pedestrianSunMinutesAvoided(weighted, journeys)).toBeCloseTo(
      pedestrianSunMinutesAvoided(plain, journeys),
      6,
    );
  });
});
