import { create } from 'zustand';
import { DEFAULT_SCENARIO } from '../config';
import { meta } from '../data/dataset';
import { DEFAULT_PLANNER, type PlannerSettings } from '../lib/planner';
import type { Intervention, InterventionType, Scenario, ShadeOverride } from '../types';
import { loadUserItems, saveUserItems } from './userItems';

export type BasemapStyle = 'streets' | 'light' | 'satellite' | 'none';

export interface BasemapSettings {
  style: BasemapStyle;
  opacity: number; // 0..1
}

export interface ContextLayers {
  buildings: boolean;
  greens: boolean;
  landmarks: boolean;
  /** Restaurants and cafes: many in busy areas, so off by default. */
  food: boolean;
  trees: boolean;
}

/** A tree row or walkway being placed: the kind, and the paths picked on the map so far. */
export interface Placing {
  type: InterventionType;
  segmentIds: readonly string[];
}

/** The pages of the app. The map stays on screen on every page. */
export type AppView = 'overview' | 'plan' | 'spec' | 'ai';

/** The scenario a fresh page (and the demo preset) starts from, for the active dataset. */
export const INITIAL_SCENARIO = { ...DEFAULT_SCENARIO, budget: meta.budget.demo };

interface ScenarioState {
  scenario: Scenario;
  shadeOverrides: readonly ShadeOverride[];
  selectedInterventionId: string | null;
  selectedJourneyId: string | null;
  basemap: BasemapSettings;
  contextLayers: ContextLayers;
  view: AppView;
  planner: PlannerSettings;
  setView: (view: AppView) => void;
  setPlanner: (patch: Partial<PlannerSettings>) => void;
  /** Select an intervention and open its spec pack. */
  openIntervention: (id: string) => void;
  /** Tree rows and walkways the person placed themselves (saved per area in this browser). */
  userItems: readonly Intervention[];
  placing: Placing | null;
  setPlacing: (placing: Placing | null) => void;
  addUserItem: (item: Intervention) => void;
  removeUserItem: (id: string) => void;
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
  basemap: { style: 'light', opacity: 0.9 },
  contextLayers: { buildings: true, greens: true, landmarks: true, food: false, trees: true },
  view: 'overview',
  planner: DEFAULT_PLANNER,
  // Pick mode only has controls in the Plan builder, so leaving it cancels a half-picked row.
  setView: (view) => set((s) => ({ view, placing: view === 'plan' ? s.placing : null })),
  setPlanner: (patch) => set((s) => ({ planner: { ...s.planner, ...patch } })),
  openIntervention: (id) => set({ selectedInterventionId: id, view: 'spec', placing: null }),
  userItems: loadUserItems(),
  placing: null,
  setPlacing: (placing) => set({ placing }),
  addUserItem: (item) =>
    set((s) => {
      const userItems = [...s.userItems, item];
      saveUserItems(userItems);
      return {
        userItems,
        placing: null,
        scenario: { ...s.scenario, selectedInterventionIds: [...s.scenario.selectedInterventionIds, item.id] },
      };
    }),
  removeUserItem: (id) =>
    set((s) => {
      const userItems = s.userItems.filter((i) => i.id !== id);
      saveUserItems(userItems);
      const { [id]: _quote, ...quotes } = s.planner.quotes;
      return {
        userItems,
        planner: { ...s.planner, quotes },
        selectedInterventionId: s.selectedInterventionId === id ? null : s.selectedInterventionId,
        scenario: {
          ...s.scenario,
          selectedInterventionIds: s.scenario.selectedInterventionIds.filter((other) => other !== id),
        },
      };
    }),
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
      planner: DEFAULT_PLANNER,
    }),
}));
