import { describe, expect, test } from 'vitest';
import type { Destination, PathSegment } from '../types';
import { ANCHOR_REACH_M, anchorReach, walkwayStart } from './anchors';

const segment = (id: string, from: string, to: string, shade14: number): PathSegment => ({
  id,
  from,
  to,
  widthM: 2,
  shade: { '09:00': shade14, '12:00': shade14, '14:00': shade14, '17:00': shade14 },
  shadeSource: 'estimated',
  accessible: true,
});
const station: Destination = { id: 'd-1', nodeId: 'a', name: 'LRT station', kind: 'rail-station' };
const homes: Destination = { id: 'd-2', nodeId: 'h', name: 'Homes (east)', kind: 'home' };
const lengths: Record<string, number> = { covered: 30, more: 40, open: 50 };
const lengthOf = (id: string): number => lengths[id] ?? 0;

describe('anchorReach', () => {
  test('a walkway can start at a stop, or where its existing cover ends', () => {
    const segments = [segment('covered', 'a', 'b', 0.95), segment('open', 'b', 'c', 0)];
    const anchors = anchorReach(segments, [station], lengthOf);
    expect(anchors.get('a')?.name).toBe('LRT station');
    expect(anchors.get('b')?.name).toBe('LRT station');
    expect(anchors.has('c')).toBe(false);
  });

  test('existing shade only reaches so far', () => {
    const segments = [segment('covered', 'a', 'b', 0.95), segment('more', 'b', 'c', 0.9)];
    expect(lengthOf('covered') + lengthOf('more')).toBeGreaterThan(ANCHOR_REACH_M);
    expect(anchorReach(segments, [station], lengthOf).has('c')).toBe(false);
  });

  test('homes are not places a walkway starts from', () => {
    expect(anchorReach([], [homes], lengthOf).size).toBe(0);
  });

  test('a walkway starts at the anchored end of its first segment', () => {
    const anchors = anchorReach([segment('covered', 'a', 'b', 0.95)], [station], lengthOf);
    expect(walkwayStart({ from: 'c', to: 'b' }, anchors)).toBe('b');
    expect(walkwayStart({ from: 'c', to: 'd' }, anchors)).toBeUndefined();
  });
});
