import { useCallback } from 'react';
import { dataset, graph, meta } from '../data/dataset';
import { createEvaluator } from '../lib/optimizer';
import { INITIAL_SCENARIO, useScenarioStore } from '../store/scenario';

/** One click: 2 pm, the demo journey and budget, then recommend and apply the best plan. */
export function useDemoPreset(): () => void {
  const loadDemo = useScenarioStore((s) => s.loadDemo);
  return useCallback(() => {
    const evaluator = createEvaluator({
      graph,
      segments: dataset.neighbourhood.segments,
      destinations: dataset.neighbourhood.destinations,
      journeys: dataset.journeys,
      candidates: dataset.interventions,
      time: INITIAL_SCENARIO.time,
      canopy: INITIAL_SCENARIO.canopy,
      canopyYear: INITIAL_SCENARIO.canopyYear,
      detourLimit: INITIAL_SCENARIO.detourLimit,
      priorityWeights: INITIAL_SCENARIO.priorityWeights,
      overrides: [],
    });
    const [best] = evaluator.recommend(meta.budget.demo);
    loadDemo(best?.interventionIds ?? []);
  }, [loadDemo]);
}
