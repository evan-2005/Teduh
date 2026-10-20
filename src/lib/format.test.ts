import { describe, expect, test } from 'vitest';
import { demoLabel, formatClock, formatMultiplier, formatMyr, formatPedestrianSun } from './format';

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

  test('formatMultiplier shows one decimal, or two for quarters', () => {
    expect(formatMultiplier(1)).toBe('×1.0');
    expect(formatMultiplier(2.5)).toBe('×2.5');
    expect(formatMultiplier(1.25)).toBe('×1.25');
    expect(formatMultiplier(0.75)).toBe('×0.75');
  });

  test('formatClock reads time slots as a 12-hour clock', () => {
    expect(formatClock('09:00')).toBe('9 am');
    expect(formatClock('12:00')).toBe('12 pm');
    expect(formatClock('14:00')).toBe('2 pm');
    expect(formatClock('17:30')).toBe('5:30 pm');
    expect(formatClock('00:00')).toBe('12 am');
  });

  test('demoLabel names both ends of the walk in running text', () => {
    expect(demoLabel('14:00', { from: 'LRT station', to: 'Shopping mall' })).toBe(
      'Demo: 2 pm walk from the LRT station to the shopping mall',
    );
    expect(demoLabel('09:00', { from: 'Bus stop (north)', to: 'School' })).toBe(
      'Demo: 9 am walk from the bus stop (north) to the school',
    );
    expect(demoLabel('14:00', { from: 'Homes (east)', to: 'Clinic' })).toBe(
      'Demo: 2 pm walk from homes (east) to the clinic',
    );
  });

  test('demoLabel falls back to the destination alone, then to a generic label', () => {
    expect(demoLabel('14:00', { from: null, to: 'Supermarket' })).toBe('Demo: 2 pm walk to the supermarket');
    expect(demoLabel('14:00', null)).toBe('Demo: 2 pm walk to a nearby place');
  });
});
