import { EXPOSED_THRESHOLD, WALK_SPEED_M_PER_MIN } from '../config';
import type { RouteResult } from '../types';
import type { Graph } from './graph';
import type { Route } from './routing';
import type { ShadeLookup } from './shade';

export interface SegmentSpan { lengthM: number; shade: number }

export const walkMin = (spans: readonly SegmentSpan[]): number =>
  spans.reduce((sum, s) => sum + s.lengthM, 0) / WALK_SPEED_M_PER_MIN;

export const sunMin = (spans: readonly SegmentSpan[]): number =>
  spans.reduce((sum, s) => sum + s.lengthM * (1 - s.shade), 0) / WALK_SPEED_M_PER_MIN;

/** Longest run of consecutive exposed segments, summed in metres. */
export function longestExposedM(spans: readonly SegmentSpan[]): number {
  let run = 0;
  let longest = 0;
  for (const span of spans) {
    run = span.shade < EXPOSED_THRESHOLD ? run + span.lengthM : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

export function routeResult(
  journeyId: string,
  route: Route,
  graph: Graph,
  shade: ShadeLookup,
): RouteResult {
  const spans = route.segmentIds.map((id) => ({
    lengthM: graph.lengthBySegment.get(id) ?? 0,
    shade: shade.get(id) ?? 0,
  }));
  return {
    journeyId,
    segmentIds: route.segmentIds,
    lengthM: route.lengthM,
    walkMin: walkMin(spans),
    sunMin: sunMin(spans),
    longestExposedM: longestExposedM(spans),
  };
}
