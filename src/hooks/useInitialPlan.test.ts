import { describe, expect, test } from 'vitest';
import type { PlanResult } from '../types';
import { startingPlan } from './useInitialPlan';

const plan = (ids: string[]) => ({ interventionIds: ids }) as PlanResult;

describe('startingPlan', () => {
  test('applies the best recommendation when nothing is chosen yet', () => {
    expect(startingPlan([plan(['a', 'b']), plan(['c'])], [])).toEqual(['a', 'b']);
  });

  test('leaves an existing selection alone', () => {
    expect(startingPlan([plan(['a'])], ['c'])).toBeNull();
  });

  test('does nothing when no plan helps', () => {
    expect(startingPlan([], [])).toBeNull();
  });
});
