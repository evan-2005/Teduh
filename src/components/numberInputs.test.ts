import { describe, expect, test } from 'vitest';
import { parsePrice } from './CostControls';
import { parseBudget } from './ScenarioControls';

describe('typed numbers', () => {
  test('read scientific notation as the number it is', () => {
    expect(parsePrice('1e3')).toBe(1000);
    expect(parseBudget('1e5')).toBe(100_000);
  });

  test('reject negative values instead of dropping the sign', () => {
    expect(parsePrice('-5')).toBeNull();
    expect(parseBudget('-5')).toBeNull();
  });

  test('accept thousands separators and reject text', () => {
    expect(parseBudget('100,000')).toBe(100_000);
    expect(parsePrice('12.50')).toBe(12.5);
    expect(parsePrice('abc')).toBeNull();
    expect(parseBudget('')).toBeNull();
  });
});
