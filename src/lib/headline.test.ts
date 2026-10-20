import { describe, expect, test } from 'vitest';
import type { Journey, PlanResult, RouteResult } from '../types';
import { headlineBreakdown } from './headline';
import { pedestrianSunMinutesAvoided } from './optimizer';

const route = (journeyId: string, sunMin: number): RouteResult => ({
  journeyId,
  segmentIds: [],
  lengthM: 0,
  walkMin: 0,
  sunMin,
  longestExposedM: 0,
});

const journeys: Journey[] = [
  { id: 'a', originId: 'o', destinationId: 'mall', dailyTrips: 600, tripsSource: 'estimated' },
  { id: 'b', originId: 'o', destinationId: 'clinic', dailyTrips: 100, tripsSource: 'estimated' },
  { id: 'c', originId: 'o', destinationId: 'park', dailyTrips: 50, tripsSource: 'estimated' },
];

const plan: PlanResult = {
  interventionIds: ['w'],
  installCost: 0,
  annualMaintenance: 0,
  sunMinutesAvoidedPerDay: 0,
  journeys: [
    { journeyId: 'a', before: route('a', 3), after: route('a', 2) },
    { journeyId: 'b', before: route('b', 4), after: route('b', 1) },
    { journeyId: 'c', before: route('c', 5), after: route('c', 5) },
  ],
  journeysImproved: ['a', 'b'],
  contributions: {},
};

describe('headlineBreakdown', () => {
  const result = headlineBreakdown(plan, journeys, (id) => id.toUpperCase());

  test('one row per walk: trips × (sun before − sun after), biggest first', () => {
    expect(result.rows.map((r) => [r.label, r.minutesAvoided])).toEqual([
      ['O → MALL', 600],
      ['O → CLINIC', 300],
      ['O → PARK', 0],
    ]);
    expect(result.rows[1]).toMatchObject({ trips: 100, sunBefore: 4, sunAfter: 1 });
  });

  test('the total is the headline figure, in minutes and hours', () => {
    expect(result.totalMinutes).toBe(900);
    expect(result.totalMinutes).toBe(pedestrianSunMinutesAvoided(plan, journeys));
    expect(result.totalHours).toBe(15);
  });
});
