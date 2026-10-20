import { describe, expect, test } from 'vitest';
import { MAX_WEIGHT, MIN_WEIGHT, parseWeight } from './priority';

describe('parseWeight', () => {
  test('reads plain numbers and a leading × or x', () => {
    expect(parseWeight('2')).toBe(2);
    expect(parseWeight('1.5')).toBe(1.5);
    expect(parseWeight('×3')).toBe(3);
    expect(parseWeight(' x0.5 ')).toBe(0.5);
  });

  test('snaps to the nearest quarter', () => {
    expect(parseWeight('1.3')).toBe(1.25);
    expect(parseWeight('1.4')).toBe(1.5);
  });

  test('keeps weights inside the allowed range', () => {
    expect(parseWeight('9')).toBe(MAX_WEIGHT);
    expect(parseWeight('-1')).toBe(MIN_WEIGHT);
  });

  test('rejects empty or non-numeric text', () => {
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('abc')).toBeNull();
    expect(parseWeight('×')).toBeNull();
  });
});
