import { describe, expect, test } from 'vitest';
import type { ExplainRequest } from '../src/features/ai-scan/schemas';
import { explanationFromReply, hasUnknownFigure } from './ai';

const route = (journeyId: string) => ({
  journeyId,
  segmentIds: [],
  lengthM: 500,
  walkMin: 6,
  sunMin: 4,
  longestExposedM: 120,
});

const PLAN: ExplainRequest = {
  interventionIds: ['shelter', 'trees'],
  interventionNames: { shelter: 'Bus-stop shelter (240 m)', trees: 'Street-tree row (9 trees)' },
  installCost: 18000,
  annualMaintenance: 1200,
  sunMinutesAvoidedPerDay: 3100,
  pedestrianSunMinutesAvoided: 2820,
  journeys: ['a', 'b', 'c'].map((id) => ({ journeyId: id, before: route(id), after: route(id) })),
  journeysImproved: ['a', 'b'],
  contributions: { shelter: 35, trees: 60 },
};

const SOURCE = 'a local model (qwen2.5vl:7b)';

describe('hasUnknownFigure', () => {
  test('passes a summary that only uses plan facts', () => {
    const summary =
      'The plan costs RM 18,000 (MYR18000) with RM 1,200 a year in upkeep. It avoids 2,820 ' +
      'pedestrian sun-minutes, about 47.0 pedestrian-hours, a day and improves 2 of 3 journeys. ' +
      'The tree row adds the most, 60 minutes a day, across its 2 interventions.';
    expect(hasUnknownFigure(summary, PLAN)).toBe(false);
  });

  test('allows numbers that appear inside intervention names', () => {
    expect(hasUnknownFigure('A 240 m shelter and a row of 9 trees.', PLAN)).toBe(false);
  });

  test.each([
    'That is MYR 9,000 per journey improved.',
    'It plants 17 trees in total.',
    'Upkeep is RM 1,250 a year.',
    'About 47.5 pedestrian-hours are avoided.',
  ])('flags "%s"', (summary) => {
    expect(hasUnknownFigure(summary, PLAN)).toBe(true);
  });
});

describe('explanationFromReply', () => {
  test('keeps a model summary that uses only plan facts', () => {
    const summary = 'This plan costs RM 18,000 and improves 2 of 3 journeys.';
    expect(explanationFromReply(summary, PLAN, SOURCE)).toEqual({
      summary,
      isMock: false,
      source: SOURCE,
    });
  });

  test('falls back to the template when the model invents a figure', () => {
    const response = explanationFromReply('Cost is MYR 9,000 per journey.', PLAN, SOURCE);
    expect(response.isMock).toBe(true);
    expect(response.summary).toContain('RM 18,000');
    expect(response.summary).toContain('47.0 pedestrian-hours');
  });
});
