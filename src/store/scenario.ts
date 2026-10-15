import { create } from 'zustand';
import { DEFAULT_SCENARIO } from '../config';
import { meta } from '../data/dataset';
import type { Scenario, ShadeOverride } from '../types';

export type BasemapStyle = 'streets' | 'light' | 'satellite' | 'none';

export interface BasemapSettings {
  style: BasemapStyle;
  opacity: number; // 0..1
}

export interface ContextLayers {
  buildings: boolean;
  greens: boolean;
  landmarks: boolean;
  trees: boolean;
}

/** The scenario a fresh page (and the demo preset) starts from, for the active dataset. */
export const INITIAL_SCENARIO = { ...DEFAULT_SCENARIO, budget: meta.budget.demo };

interface ScenarioState {
  scenario: Scenario;
  shadeOverrides: readonly ShadeOverride[];
  selectedInterventionId: string | null;
  selectedJourneyId: string | null;
  basemap: BasemapSettings;
  contextLayers: ContextLayers;
  setScenario: (patch: Partial<Scenario>) => void;
  applyShadeOverride: (override: ShadeOverride) => void;
  selectIntervention: (id: string | null) => void;
  selectJourney: (id: string | null) => void;
  setBasemap: (patch: Partial<BasemapSettings>) => void;
  setContextLayers: (patch: Partial<ContextLayers>) => void;
  toggleIntervention: (id: string) => void;
  applyPlan: (interventionIds: readonly string[]) => void;
  setPriorityWeight: (destinationId: string, weight: number) => void;
  clearShadeOverrides: () => void;
  /** Reset to the demo scenario with the given plan applied. */
  loadDemo: (interventionIds: readonly string[]) => void;
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
  scenario: INITIAL_SCENARIO,
  shadeOverrides: [],
  selectedInterventionId: null,
  selectedJourneyId: meta.demoJourneyId,
  basemap: { style: 'streets', opacity: 0.6 },
  contextLayers: { buildings: true, greens: true, landmarks: true, trees: true },
  setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
  applyShadeOverride: (override) =>
    set((s) => ({ shadeOverrides: withOverride(s.shadeOverrides, override) })),
  selectIntervention: (id) => set({ selectedInterventionId: id }),
  selectJourney: (id) => set({ selectedJourneyId: id }),
  setBasemap: (patch) => set((s) => ({ basemap: { ...s.basemap, ...patch } })),
  setContextLayers: (patch) => set((s) => ({ contextLayers: { ...s.contextLayers, ...patch } })),
  toggleIntervention: (id) =>
    set((s) => ({
      scenario: {
        ...s.scenario,
        selectedInterventionIds: s.scenario.selectedInterventionIds.includes(id)
          ? s.scenario.selectedInterventionIds.filter((other) => other !== id)
          : [...s.scenario.selectedInterventionIds, id],
      },
    })),
  applyPlan: (interventionIds) =>
    set((s) => ({ scenario: { ...s.scenario, selectedInterventionIds: [...interventionIds] } })),
  setPriorityWeight: (destinationId, weight) =>
    set((s) => ({
      scenario: {
        ...s.scenario,
        priorityWeights: { ...s.scenario.priorityWeights, [destinationId]: weight },
      },
    })),
  clearShadeOverrides: () => set({ shadeOverrides: [] }),
  loadDemo: (interventionIds) =>
    set({
      scenario: { ...INITIAL_SCENARIO, selectedInterventionIds: [...interventionIds] },
      shadeOverrides: [],
      selectedJourneyId: meta.demoJourneyId,
      selectedInterventionId: null,
    }),
}));
