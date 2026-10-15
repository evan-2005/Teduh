import { create } from 'zustand';
import { DEFAULT_SCENARIO } from '../config';
import type { Scenario, ShadeOverride } from '../types';

interface ScenarioState {
  scenario: Scenario;
  shadeOverrides: readonly ShadeOverride[];
  selectedInterventionId: string | null;
  selectedJourneyId: string | null;
  setScenario: (patch: Partial<Scenario>) => void;
  applyShadeOverride: (override: ShadeOverride) => void;
  selectIntervention: (id: string | null) => void;
  selectJourney: (id: string | null) => void;
}

/** Replace any override for the same segment + time, keeping the list immutable. */
const withOverride = (
  list: readonly ShadeOverride[],
  next: ShadeOverride,
): readonly ShadeOverride[] => [
  ...list.filter((o) => !(o.segmentId === next.segmentId && o.time === next.time)),
  next,
];

export const useScenarioStore = create<ScenarioState>((set) => ({
  scenario: DEFAULT_SCENARIO,
  shadeOverrides: [],
  selectedInterventionId: null,
  selectedJourneyId: null,
  setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
  applyShadeOverride: (override) =>
    set((s) => ({ shadeOverrides: withOverride(s.shadeOverrides, override) })),
  selectIntervention: (id) => set({ selectedInterventionId: id }),
  selectJourney: (id) => set({ selectedJourneyId: id }),
}));
