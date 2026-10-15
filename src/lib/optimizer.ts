import { MAX_CANDIDATES } from '../config';
import type {
  CanopyMode,
  Destination,
  Intervention,
  Journey,
  PathSegment,
  PlanResult,
  RouteResult,
  ShadeOverride,
  TimeSlot,
} from '../types';
import type { Graph } from './graph';
import { routeResult } from './metrics';
import { leastSunRoute } from './routing';
import { buildShadeLookup } from './shade';

export interface OptimizerInput {
  graph: Graph;
  segments: readonly PathSegment[];
  destinations: readonly Destination[];
  journeys: readonly Journey[];
  candidates: readonly Intervention[];
  time: TimeSlot;
  canopy: CanopyMode;
  canopyYear: number;
  detourLimit: number;
  /** Destination.id -> multiplier (default 1). */
  priorityWeights: Readonly<Record<string, number>>;
  overrides: readonly ShadeOverride[];
}

export interface Evaluator {
  /** Full result for an arbitrary set of interventions (e.g. the user's selection). */
  plan(interventionIds: readonly string[]): PlanResult;
  /**
   * Top plans within budget, best first. Plans never contain dead weight, and each alternative
   * is cheaper than the plans ranked above it (no dominated or duplicate options).
   */
  recommend(budget: number, topN?: number): PlanResult[];
}

interface Evaluation {
  routes: ReadonlyMap<string, RouteResult>;
  score: number;
  installCost: number;
  annualMaintenance: number;
  maxExposedM: number;
}

const DEFAULT_TOP_N = 3;
const SCORE_EPSILON = 1e-6;

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** Σ trips × (sunBefore − sunAfter), unweighted: real pedestrian sun-minutes per day. */
export function pedestrianSunMinutesAvoided(
  plan: PlanResult,
  journeys: readonly Journey[],
): number {
  const trips = new Map(journeys.map((j) => [j.id, j.dailyTrips]));
  return sum(
    plan.journeys.map((c) => (trips.get(c.journeyId) ?? 0) * (c.before.sunMin - c.after.sunMin)),
  );
}

export function createEvaluator(input: OptimizerInput): Evaluator {
  if (input.candidates.length > MAX_CANDIDATES) {
    throw new Error(`Too many candidates: ${input.candidates.length} > ${MAX_CANDIDATES}`);
  }
  const candidatesById = new Map(input.candidates.map((c) => [c.id, c]));
  const nodeOfDestination = new Map(input.destinations.map((d) => [d.id, d.nodeId]));
  const memo = new Map<string, Evaluation>();

  const computeRoutes = (interventions: readonly Intervention[]): Map<string, RouteResult> => {
    const shade = buildShadeLookup(input.segments, {
      time: input.time,
      canopy: input.canopy,
      canopyYear: input.canopyYear,
      interventions,
      overrides: input.overrides,
    });
    const routes = new Map<string, RouteResult>();
    for (const journey of input.journeys) {
      const from = nodeOfDestination.get(journey.originId);
      const to = nodeOfDestination.get(journey.destinationId);
      if (from === undefined || to === undefined) continue;
      const route = leastSunRoute(input.graph, from, to, shade, input.detourLimit);
      if (route) routes.set(journey.id, routeResult(journey.id, route, input.graph, shade));
    }
    return routes;
  };

  const baseline = computeRoutes([]);

  const scoreOf = (routes: ReadonlyMap<string, RouteResult>): number =>
    sum(
      input.journeys.map((j) => {
        const before = baseline.get(j.id);
        const after = routes.get(j.id);
        if (!before || !after) return 0;
        const weight = input.priorityWeights[j.destinationId] ?? 1;
        return j.dailyTrips * weight * (before.sunMin - after.sunMin);
      }),
    );

  const evaluate = (ids: readonly string[]): Evaluation => {
    const key = [...ids].sort().join('|');
    const cached = memo.get(key);
    if (cached) return cached;
    const chosen = ids.map((id) => candidatesById.get(id)).filter((c): c is Intervention => !!c);
    const routes = computeRoutes(chosen);
    const evaluation: Evaluation = {
      routes,
      score: scoreOf(routes),
      installCost: sum(chosen.map((c) => c.installCost)),
      annualMaintenance: sum(chosen.map((c) => c.annualMaintenance)),
      maxExposedM: Math.max(0, ...[...routes.values()].map((r) => r.longestExposedM)),
    };
    memo.set(key, evaluation);
    return evaluation;
  };

  const marginal = (ids: readonly string[], id: string): number =>
    evaluate(ids).score - evaluate(ids.filter((other) => other !== id)).score;

  const plan = (ids: readonly string[]): PlanResult => {
    const evaluation = evaluate(ids);
    const journeys = input.journeys.flatMap((j) => {
      const before = baseline.get(j.id);
      const after = evaluation.routes.get(j.id);
      return before && after ? [{ journeyId: j.id, before, after }] : [];
    });
    return {
      interventionIds: [...ids],
      installCost: evaluation.installCost,
      annualMaintenance: evaluation.annualMaintenance,
      sunMinutesAvoidedPerDay: evaluation.score,
      journeys,
      journeysImproved: journeys
        .filter((c) => c.before.sunMin - c.after.sunMin > SCORE_EPSILON)
        .map((c) => c.journeyId),
      contributions: Object.fromEntries(ids.map((id) => [id, marginal(ids, id)])),
    };
  };

  const recommend = (budget: number, topN = DEFAULT_TOP_N): PlanResult[] => {
    const count = input.candidates.length;
    const viable: string[][] = [];
    for (let mask = 1; mask < 1 << count; mask++) {
      const ids = input.candidates.filter((_, i) => mask & (1 << i)).map((c) => c.id);
      const cost = sum(ids.map((id) => candidatesById.get(id)!.installCost));
      if (cost > budget) continue;
      const { score } = evaluate(ids);
      // Dead-weight pruning: every member must add something on its own.
      if (score > SCORE_EPSILON && ids.every((id) => marginal(ids, id) > SCORE_EPSILON)) {
        viable.push(ids);
      }
    }
    const ranked = viable.sort((a, b) => compareEvaluations(evaluate(a), evaluate(b)));
    return distinctTradeOffs(ranked, (ids) => evaluate(ids).installCost, topN).map(plan);
  };

  return { plan, recommend };
}

/**
 * Walk the ranked plans (best first) and keep one only if it is cheaper than every plan kept so
 * far. A plan that costs the same or more but helps less is never worth offering, and this also
 * drops interchangeable twins (same cost, same score).
 */
function distinctTradeOffs(
  ranked: readonly string[][],
  costOf: (ids: readonly string[]) => number,
  topN: number,
): string[][] {
  const kept: string[][] = [];
  for (const ids of ranked) {
    if (kept.length >= topN) break;
    const cost = costOf(ids);
    if (kept.every((other) => cost < costOf(other))) kept.push(ids);
  }
  return kept;
}

/** Higher score first; then cheaper; then shorter worst exposed stretch. */
function compareEvaluations(a: Evaluation, b: Evaluation): number {
  if (Math.abs(a.score - b.score) > SCORE_EPSILON) return b.score - a.score;
  if (a.installCost !== b.installCost) return a.installCost - b.installCost;
  return a.maxExposedM - b.maxExposedM;
}
