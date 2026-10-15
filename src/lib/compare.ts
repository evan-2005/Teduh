import type { Destination, Journey, RouteResult } from '../types';
import type { Graph } from './graph';
import { routeResult } from './metrics';
import { leastSunRoute, shortestRoute } from './routing';
import type { ShadeLookup } from './shade';

export interface RouteComparison {
  shortest: RouteResult;
  leastSun: RouteResult;
}

/** Shortest vs least-sun route for one journey, or null if the pair is unreachable. */
export function compareJourney(
  graph: Graph,
  journey: Journey,
  destinations: readonly Destination[],
  shade: ShadeLookup,
  detourLimit: number,
): RouteComparison | null {
  const origin = destinations.find((d) => d.id === journey.originId);
  const target = destinations.find((d) => d.id === journey.destinationId);
  if (!origin || !target) return null;

  const shortest = shortestRoute(graph, origin.nodeId, target.nodeId);
  const leastSun = leastSunRoute(graph, origin.nodeId, target.nodeId, shade, detourLimit);
  if (!shortest || !leastSun) return null;

  return {
    shortest: routeResult(journey.id, shortest, graph, shade),
    leastSun: routeResult(journey.id, leastSun, graph, shade),
  };
}
