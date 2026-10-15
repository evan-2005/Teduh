import { describe, expect, test } from 'vitest';
import { haversineM, segmentLengthM } from './geo';
import { makeNode, makeSegment } from './testGraph';

describe('haversineM', () => {
  test('is zero for identical points', () => {
    expect(haversineM({ lat: 3.1, lng: 101.6 }, { lat: 3.1, lng: 101.6 })).toBe(0);
  });

  test('one degree of latitude is about 111.2 km', () => {
    const d = haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  test('is symmetric', () => {
    const a = { lat: 3.1, lng: 101.6 };
    const b = { lat: 3.2, lng: 101.7 };
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 6);
  });
});

describe('segmentLengthM', () => {
  const nodes = new Map([
    ['a', { id: 'a', lat: 3.1, lng: 101.6 }],
    ['b', { id: 'b', lat: 3.1009, lng: 101.6 }],
  ]);

  test('prefers an explicit lengthM', () => {
    expect(segmentLengthM(makeSegment('s', 'a', 'b', 42), nodes)).toBe(42);
  });

  test('computes from coordinates when lengthM is absent', () => {
    const segment = { ...makeSegment('s', 'a', 'b', 1), lengthM: undefined };
    expect(segmentLengthM(segment, nodes)).toBeCloseTo(100, -1);
  });

  test('throws on an unknown node', () => {
    const segment = { ...makeSegment('s', 'a', 'zzz', 1), lengthM: undefined };
    expect(() => segmentLengthM(segment, nodes)).toThrow(/unknown node/);
  });

  test('makeNode is usable as a PathNode', () => {
    expect(makeNode('x').id).toBe('x');
  });
});
