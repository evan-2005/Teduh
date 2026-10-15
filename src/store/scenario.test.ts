import { beforeEach, describe, expect, test } from 'vitest';
import { DEFAULT_SCENARIO } from '../config';
import { INITIAL_SCENARIO, useScenarioStore } from './scenario';

describe('scenario store', () => {
  beforeEach(() => {
    useScenarioStore.setState({
      scenario: DEFAULT_SCENARIO,
      shadeOverrides: [],
      selectedInterventionId: null,
    });
  });

  test('setScenario merges a patch without mutating the previous scenario', () => {
    const before = useScenarioStore.getState().scenario;
    useScenarioStore.getState().setScenario({ budget: 10_000 });
    const after = useScenarioStore.getState().scenario;
    expect(after.budget).toBe(10_000);
    expect(after.time).toBe(before.time);
    expect(before.budget).toBe(INITIAL_SCENARIO.budget);
  });

  test('applyShadeOverride replaces an override for the same segment and time', () => {
    const { applyShadeOverride } = useScenarioStore.getState();
    applyShadeOverride({ segmentId: 's1', time: '14:00', shade: 0.2, source: 'ai-confirmed' });
    applyShadeOverride({ segmentId: 's1', time: '14:00', shade: 0.6, source: 'ai-confirmed' });
    applyShadeOverride({ segmentId: 's1', time: '12:00', shade: 0.4, source: 'ai-confirmed' });
    const overrides = useScenarioStore.getState().shadeOverrides;
    expect(overrides).toHaveLength(2);
    expect(overrides.find((o) => o.time === '14:00')?.shade).toBe(0.6);
  });

  test('selectIntervention stores and clears the selection', () => {
    useScenarioStore.getState().selectIntervention('shelter-connector');
    expect(useScenarioStore.getState().selectedInterventionId).toBe('shelter-connector');
    useScenarioStore.getState().selectIntervention(null);
    expect(useScenarioStore.getState().selectedInterventionId).toBeNull();
  });
});

describe('plan actions', () => {
  beforeEach(() => {
    useScenarioStore.setState({ scenario: DEFAULT_SCENARIO });
  });

  test('toggleIntervention adds then removes an id', () => {
    const { toggleIntervention } = useScenarioStore.getState();
    toggleIntervention('a');
    toggleIntervention('b');
    expect(useScenarioStore.getState().scenario.selectedInterventionIds).toEqual(['a', 'b']);
    toggleIntervention('a');
    expect(useScenarioStore.getState().scenario.selectedInterventionIds).toEqual(['b']);
  });

  test('applyPlan replaces the selection with a copy', () => {
    const ids = ['x', 'y'];
    useScenarioStore.getState().applyPlan(ids);
    const stored = useScenarioStore.getState().scenario.selectedInterventionIds;
    expect(stored).toEqual(['x', 'y']);
    expect(stored).not.toBe(ids);
  });

  test('setPriorityWeight updates one destination and keeps the others', () => {
    const { setPriorityWeight } = useScenarioStore.getState();
    setPriorityWeight('dest-school', 2);
    setPriorityWeight('dest-bus', 0.5);
    expect(useScenarioStore.getState().scenario.priorityWeights).toEqual({
      'dest-school': 2,
      'dest-bus': 0.5,
    });
  });
});

describe('demo and AI edits', () => {
  test('loadDemo resets the scenario, applies the plan and clears AI edits', () => {
    const state = useScenarioStore.getState();
    state.setScenario({ budget: 1, time: '09:00', mapMode: 'before' });
    state.applyShadeOverride({ segmentId: 's', time: '09:00', shade: 1, source: 'ai-confirmed' });
    state.selectJourney('j-home-b-bus');
    state.loadDemo(['shelter-connector']);
    const next = useScenarioStore.getState();
    expect(next.scenario).toEqual({ ...INITIAL_SCENARIO, selectedInterventionIds: ['shelter-connector'] });
    expect(next.shadeOverrides).toEqual([]);
    expect(next.selectedJourneyId).toBe('j-home-a-shops');
  });

  test('clearShadeOverrides removes every override', () => {
    const state = useScenarioStore.getState();
    state.applyShadeOverride({ segmentId: 's', time: '12:00', shade: 0.4, source: 'ai-confirmed' });
    state.clearShadeOverrides();
    expect(useScenarioStore.getState().shadeOverrides).toEqual([]);
  });
});
