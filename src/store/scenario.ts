import { create } from 'zustand';
import { DEFAULT_SCENARIO, DEMO_JOURNEY_ID } from '../config';
import type { Scenario, ShadeOverride } from '../types';

export interface BasemapSettings {
  visible: boolean;
  opacity: number; // 0..1
}

interface ScenarioState {
  scenario: Scenario;
  shadeOverrides: readonly ShadeOverride[];
  selectedInterventionId: string | null;
  selectedJourneyId: string | null;
  basemap: BasemapSettings;
  setScenario: (patch: Partial<Scenario>) => void;
  applyShadeOverride: (override: ShadeOverride) => void;
  selectIntervention: (id: string | null) => void;
  selectJourney: (id: string | null) => void;
  setBasemap: (patch: Partial<BasemapSettings>) => void;
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
  selectedJourneyId: DEMO_JOURNEY_ID,
  basemap: { visible: true, opacity: 0.5 },
  setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
  applyShadeOverride: (override) =>
    set((s) => ({ shadeOverrides: withOverride(s.shadeOverrides, override) })),
  selectIntervention: (id) => set({ selectedInterventionId: id }),
  selectJourney: (id) => set({ selectedJourneyId: id }),
  setBasemap: (patch) => set((s) => ({ basemap: { ...s.basemap, ...patch } })),
}));
