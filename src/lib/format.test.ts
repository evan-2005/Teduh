import { describe, expect, test } from 'vitest';
import { formatMultiplier, formatMyr, formatPedestrianSun } from './format';

describe('format', () => {
  test('formatMyr groups thousands and rounds', () => {
    expect(formatMyr(18000)).toBe('RM 18,000');
    expect(formatMyr(0)).toBe('RM 0');
    expect(formatMyr(1234.6)).toBe('RM 1,235');
  });

  test('formatPedestrianSun switches to hours at 60 minutes', () => {
    expect(formatPedestrianSun(30)).toEqual({ value: '30', unit: 'pedestrian-minutes' });
    expect(formatPedestrianSun(60)).toEqual({ value: '1.0', unit: 'pedestrian-hours' });
    expect(formatPedestrianSun(2520)).toEqual({ value: '42.0', unit: 'pedestrian-hours' });
  });

  test('formatMultiplier shows one decimal', () => {
    expect(formatMultiplier(1)).toBe('×1.0');
    expect(formatMultiplier(2.5)).toBe('×2.5');
  });
});
