import { useDeferredValue, useMemo } from 'react';
import { dataset, graph } from '../data/dataset';
import { createEvaluator } from '../lib/optimizer';
import { useScenarioStore } from '../store/scenario';
import type { PlanResult } from '../types';

export interface OptimizerView {
  /** Top plans within budget, best first. */
  plans: PlanResult[];
  /** Result for the interventions currently ticked (an all-zero plan when none are). */
  selectedPlan: PlanResult;
}

/** Recomputes recommendations and the selected plan whenever a scenario input changes. */
export function useOptimizer(): OptimizerView {
  const scenario = useScenarioStore((s) => s.scenario);
  const overrides = useScenarioStore((s) => s.shadeOverrides);
  // Keep the budget slider responsive: recommendations may lag a frame behind.
  const budget = useDeferredValue(scenario.budget);

  const evaluator = useMemo(
    () =>
      createEvaluator({
        graph,
        segments: dataset.neighbourhood.segments,
        destinations: dataset.neighbourhood.destinations,
        journeys: dataset.journeys,
        candidates: dataset.interventions,
        time: scenario.time,
        canopy: scenario.canopy,
        canopyYear: scenario.canopyYear,
        detourLimit: scenario.detourLimit,
        priorityWeights: scenario.priorityWeights,
        overrides,
      }),
    [
      scenario.time,
      scenario.canopy,
      scenario.canopyYear,
      scenario.detourLimit,
      scenario.priorityWeights,
      overrides,
    ],
  );

  const plans = useMemo(() => evaluator.recommend(budget), [evaluator, budget]);
  const selectedPlan = useMemo(
    () => evaluator.plan(scenario.selectedInterventionIds),
    [evaluator, scenario.selectedInterventionIds],
  );

  return { plans, selectedPlan };
}
