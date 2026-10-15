import { useMemo } from 'react';
import { dataset, graph } from '../data/dataset';
import { compareJourney, type RouteComparison } from '../lib/compare';
import { buildShadeLookup, type ShadeLookup } from '../lib/shade';
import { useScenarioStore } from '../store/scenario';
import type { Journey } from '../types';

export interface NetworkView {
  shade: ShadeLookup;
  journey: Journey | null;
  comparison: RouteComparison | null;
}

/** Everything the map and route panel derive from the current scenario. */
export function useNetworkView(): NetworkView {
  const scenario = useScenarioStore((s) => s.scenario);
  const overrides = useScenarioStore((s) => s.shadeOverrides);
  const journeyId = useScenarioStore((s) => s.selectedJourneyId);

  const shade = useMemo(() => {
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
  }, [scenario.time, scenario.canopy, scenario.canopyYear, scenario.selectedInterventionIds, overrides]);

  const journey = dataset.journeys.find((j) => j.id === journeyId) ?? null;

  const comparison = useMemo(
    () =>
      journey
        ? compareJourney(graph, journey, dataset.neighbourhood.destinations, shade, scenario.detourLimit)
        : null,
    [journey, shade, scenario.detourLimit],
  );

  return { shade, journey, comparison };
}
