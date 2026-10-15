import { useCallback } from 'react';
import { DEFAULT_SCENARIO, DEMO_BUDGET } from '../config';
import { dataset, graph } from '../data/dataset';
import { createEvaluator } from '../lib/optimizer';
import { useScenarioStore } from '../store/scenario';

/** One click: 2 pm, Home A → shops, RM 25k, then recommend and apply the best plan. */
export function useDemoPreset(): () => void {
  const loadDemo = useScenarioStore((s) => s.loadDemo);
  return useCallback(() => {
    const evaluator = createEvaluator({
      graph,
      segments: dataset.neighbourhood.segments,
      destinations: dataset.neighbourhood.destinations,
      journeys: dataset.journeys,
      candidates: dataset.interventions,
      time: DEFAULT_SCENARIO.time,
      canopy: DEFAULT_SCENARIO.canopy,
      canopyYear: DEFAULT_SCENARIO.canopyYear,
      detourLimit: DEFAULT_SCENARIO.detourLimit,
      priorityWeights: DEFAULT_SCENARIO.priorityWeights,
      overrides: [],
    });
    const [best] = evaluator.recommend(DEMO_BUDGET);
    loadDemo(best?.interventionIds ?? []);
  }, [loadDemo]);
}
