import { useMemo } from 'react';
import { dataset, graph } from '../data/dataset';
import { compareJourney, type RouteComparison } from '../lib/compare';
import { buildShadeLookup, type ShadeLookup } from '../lib/shade';
import { useScenarioStore } from '../store/scenario';
import type { Journey } from '../types';

export interface LayerView {
  shade: ShadeLookup;
  comparison: RouteComparison | null;
}

export interface NetworkView {
  /** The network as surveyed: no interventions applied. */
  before: LayerView;
  /** The network with the selected interventions applied. */
  after: LayerView;
  journey: Journey | null;
}

/** Everything the map and route panel derive from the current scenario. */
export function useNetworkView(): NetworkView {
  const scenario = useScenarioStore((s) => s.scenario);
  const overrides = useScenarioStore((s) => s.shadeOverrides);
  const journeyId = useScenarioStore((s) => s.selectedJourneyId);
  const journey = dataset.journeys.find((j) => j.id === journeyId) ?? null;

  const shadeBefore = useMemo(
    () =>
      buildShadeLookup(dataset.neighbourhood.segments, {
        time: scenario.time,
        canopy: scenario.canopy,
        canopyYear: scenario.canopyYear,
        interventions: [],
        overrides,
      }),
    [scenario.time, scenario.canopy, scenario.canopyYear, overrides],
  );

  const shadeAfter = useMemo(() => {
    const interventions = dataset.interventions.filter((i) =>
      scenario.selectedInterventionIds.includes(i.id),
    );
    return buildShadeLookup(dataset.neighbourhood.segments, {
      time: scenario.time,
      canopy: scenario.canopy,
      canopyYear: scenario.canopyYear,
      interventions,
      overrides,
    });
  }, [
    scenario.time,
    scenario.canopy,
    scenario.canopyYear,
    scenario.selectedInterventionIds,
    overrides,
  ]);

  const compare = (shade: ShadeLookup): RouteComparison | null =>
    journey
      ? compareJourney(graph, journey, dataset.neighbourhood.destinations, shade, scenario.detourLimit)
      : null;

  const comparisonBefore = useMemo(
    () => compare(shadeBefore),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [journey, shadeBefore, scenario.detourLimit],
  );
  const comparisonAfter = useMemo(
    () => compare(shadeAfter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [journey, shadeAfter, scenario.detourLimit],
  );

  return {
    before: { shade: shadeBefore, comparison: comparisonBefore },
    after: { shade: shadeAfter, comparison: comparisonAfter },
    journey,
  };
}
