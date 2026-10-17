import { useMemo } from 'react';
import { dataset, graph } from '../data/dataset';
import { adjustInterventions, type PlannerContext } from '../lib/planner';
import { useScenarioStore } from '../store/scenario';
import type { Intervention } from '../types';

const PLANNER_CONTEXT: PlannerContext = {
  segments: dataset.neighbourhood.segments,
  lengthBySegment: graph.lengthBySegment,
  unitCosts: dataset.unitCosts,
};

/**
 * The area's candidates with the planner settings applied (tree spacing and species, walkway
 * length). Use this, not `dataset.interventions`, so every panel shows the same figures.
 */
export function useInterventions(): readonly Intervention[] {
  const planner = useScenarioStore((s) => s.planner);
  return useMemo(() => adjustInterventions(dataset.interventions, planner, PLANNER_CONTEXT), [planner]);
}

/** Name lookup for the current candidates, falling back to the id. */
export function useInterventionNames(): (id: string) => string {
  const interventions = useInterventions();
  return useMemo(() => {
    const names = new Map(interventions.map((i) => [i.id, i.name]));
    return (id: string) => names.get(id) ?? id;
  }, [interventions]);
}
