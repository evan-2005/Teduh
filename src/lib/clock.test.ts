import { describe, expect, test } from 'vitest';
import type { TimeSlot } from '../types';
import { clockOf, isSlot, minutesOf, nearestSlot, valueAt } from './clock';
import { effectiveShade } from './shade';

const SNAPSHOTS: Record<TimeSlot, number> = { '09:00': 0.8, '12:00': 0.2, '14:00': 0.4, '17:00': 0.6 };
const at = (slot: TimeSlot): number => SNAPSHOTS[slot];

describe('clock times', () => {
  test('converts between "HH:MM" and minutes', () => {
    expect(minutesOf('14:30')).toBe(870);
    expect(clockOf(870)).toBe('14:30');
    expect(clockOf(540)).toBe('09:00');
  });

  test('knows the snapshot times and the nearest one', () => {
    expect(isSlot('12:00')).toBe(true);
    expect(isSlot('12:30')).toBe(false);
    expect(nearestSlot('12:30')).toBe('12:00');
    expect(nearestSlot('16:00')).toBe('17:00');
  });
});

describe('values between snapshots', () => {
  test('exact at a snapshot', () => {
    expect(valueAt(at, '14:00')).toBe(0.4);
  });

  test('interpolated in between', () => {
    expect(valueAt(at, '10:30')).toBeCloseTo(0.5);
    expect(valueAt(at, '13:00')).toBeCloseTo(0.3);
  });

  test('held at the first and last snapshot outside their range', () => {
    expect(valueAt(at, '07:00')).toBe(0.8);
    expect(valueAt(at, '19:00')).toBe(0.6);
  });

  test('a path\'s shade at 1 pm sits between its 12 pm and 2 pm values', () => {
    const segment = {
      id: 's', from: 'a', to: 'b', widthM: 2, shade: SNAPSHOTS, shadeSource: 'estimated' as const, accessible: true,
    };
    const shade = effectiveShade(segment, { time: '13:00', canopy: 'now', canopyYear: 0, interventions: [], overrides: [] });
    expect(shade).toBeCloseTo(0.3);
  });
});
