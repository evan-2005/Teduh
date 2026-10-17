/**
 * Where a covered walkway can start: the places people wait or arrive (bus stops, stations and
 * the entrances of the places they walk to), and the ends of shade that already reaches out
 * from one, such as a station's own canopy. Shared by the candidate generator and the UI.
 */
import { EXPOSED_THRESHOLD } from '../config';
import type { Destination, PathSegment } from '../types';

/**
 * The node a walkway starts from: on its first segment (the generator's seed), the end that is
 * an anchor. The walkway only grows away from it, so this is always an end of the stretch.
 */
export const walkwayStart = (
  first: Pick<PathSegment, 'from' | 'to'>,
  anchors: ReadonlyMap<string, Destination>,
): string | undefined => (anchors.has(first.from) ? first.from : anchors.has(first.to) ? first.to : undefined);

/** A walkway may start where shade already reaching out from a stop or entrance ends. */
export const ANCHOR_REACH_M = 60;

/** Map of node id -> the place a walkway starting there serves. Homes are not anchors. */
export function anchorReach(
  segments: readonly PathSegment[],
  destinations: readonly Destination[],
  lengthOf: (segmentId: string) => number,
): Map<string, Destination> {
  const shaded = segments.filter((s) => s.accessible && s.shade['14:00'] >= EXPOSED_THRESHOLD);
  const reached = new Map<string, { place: Destination; distanceM: number }>();
  const queue = destinations
    .filter((d) => d.kind !== 'home')
    .map((place) => ({ node: place.nodeId, place, distanceM: 0 }));
  while (queue.length > 0) {
    const { node, place, distanceM } = queue.shift()!;
    const known = reached.get(node);
    if (known && known.distanceM <= distanceM) continue;
    reached.set(node, { place, distanceM });
    for (const s of shaded.filter((x) => x.from === node || x.to === node)) {
      const next = distanceM + lengthOf(s.id);
      if (next <= ANCHOR_REACH_M) queue.push({ node: s.from === node ? s.to : s.from, place, distanceM: next });
    }
  }
  return new Map([...reached].map(([node, { place }]) => [node, place]));
}
