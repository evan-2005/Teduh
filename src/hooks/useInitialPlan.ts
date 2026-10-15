import { useEffect, useRef } from 'react';
import { useScenarioStore } from '../store/scenario';
import type { PlanResult } from '../types';

/** The plan to show on first load: the best recommendation, unless something is already chosen. */
export function startingPlan(
  plans: readonly PlanResult[],
  selectedIds: readonly string[],
): readonly string[] | null {
  if (selectedIds.length > 0) return null;
  return plans[0]?.interventionIds ?? null;
}

/**
 * Apply the best plan once, on first load, so Before / After / Swipe has something to compare.
 * After that the person is in charge: clearing every candidate is not undone.
 */
export function useInitialPlan(plans: readonly PlanResult[]): void {
  const applyPlan = useScenarioStore((s) => s.applyPlan);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const ids = startingPlan(plans, useScenarioStore.getState().scenario.selectedInterventionIds);
    if (ids) applyPlan(ids);
  }, [plans, applyPlan]);
}
