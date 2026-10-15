import type { PathNode, PathSegment } from '../types';

/** Test helpers: tiny hand-made graphs. Not imported by app code. */
export const makeNode = (id: string): PathNode => ({ id, lat: 3.1, lng: 101.6 });

export const makeSegment = (
  id: string,
  from: string,
  to: string,
  lengthM: number,
  shade = 0,
  accessible = true,
): PathSegment => ({
  id,
  from,
  to,
  lengthM,
  widthM: 2,
  shade: { '09:00': shade, '12:00': shade, '14:00': shade, '17:00': shade },
  shadeSource: 'estimated',
  accessible,
});

/**
 * A ─100─ B ─100─ E     direct: 200 m, no shade
 * A ─100─ C ─40─ D ─100─ E     shady: 240 m (+20%), full shade
 */
export const fiveNodeNodes: PathNode[] = ['A', 'B', 'C', 'D', 'E'].map(makeNode);
export const fiveNodeSegments = (shadyAccessible = true): PathSegment[] => [
  makeSegment('ab', 'A', 'B', 100, 0),
  makeSegment('be', 'B', 'E', 100, 0),
  makeSegment('ac', 'A', 'C', 100, 1, shadyAccessible),
  makeSegment('cd', 'C', 'D', 40, 1, shadyAccessible),
  makeSegment('de', 'D', 'E', 100, 1, shadyAccessible),
];
