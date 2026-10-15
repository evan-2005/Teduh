import { describe, expect, test } from 'vitest';
import { spreadOverlapping, type ScreenPoint } from './spread';

const SIZE = 32;

/** Where each marker ends up after its offset is applied. */
const placed = (points: readonly ScreenPoint[]) => {
  const offsets = spreadOverlapping(points, SIZE);
  return points.map((p) => ({ id: p.id, x: p.x + offsets.get(p.id)!.dx, y: p.y + offsets.get(p.id)!.dy }));
};

const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < SIZE && Math.abs(a.y - b.y) < SIZE;

describe('spreadOverlapping', () => {
  test('leaves markers that do not touch where they are', () => {
    const offsets = spreadOverlapping([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 200, y: 0 }], SIZE);
    expect(offsets.get('a')).toEqual({ dx: 0, dy: 0 });
    expect(offsets.get('b')).toEqual({ dx: 0, dy: 0 });
  });

  test('pulls apart markers a few pixels apart, not only ones on the exact same spot', () => {
    const result = placed([{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 108, y: 95 }]);
    expect(overlap(result[0]!, result[1]!)).toBe(false);
  });

  test('spreads a chain of three overlapping markers into a row with no overlaps', () => {
    const result = placed([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 20, y: 0 },
      { id: 'c', x: 40, y: 5 },
      { id: 'far', x: 500, y: 500 },
    ]);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) expect(overlap(result[i]!, result[j]!)).toBe(false);
    }
    expect(result[3]).toEqual({ id: 'far', x: 500, y: 500 });
  });

  test('markers on the exact same spot are spread too, in a stable order', () => {
    const offsets = spreadOverlapping([{ id: 'b', x: 0, y: 0 }, { id: 'a', x: 0, y: 0 }], SIZE);
    expect(offsets.get('a')!.dx).toBeLessThan(offsets.get('b')!.dx);
  });
});
