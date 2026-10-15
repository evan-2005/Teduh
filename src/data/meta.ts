import { DEMO_BUDGET, DEMO_JOURNEY_ID, MAP_CENTER } from '../config';
import type { WalkNames } from '../lib/format';
import type { DatasetMeta, Journey, Neighbourhood } from '../types';

const DEFAULT_BUDGET_MAX = 40_000;
const DEFAULT_BUDGET_STEP = 500;

/** The dataset's own metadata, or sensible defaults for hand-made data without any. */
export function datasetMeta(neighbourhood: Neighbourhood): DatasetMeta {
  return (
    neighbourhood.meta ?? {
      name: 'Custom neighbourhood',
      center: [...MAP_CENTER],
      source: 'surveyed',
      budget: { max: DEFAULT_BUDGET_MAX, step: DEFAULT_BUDGET_STEP, demo: DEMO_BUDGET },
      demoJourneyId: DEMO_JOURNEY_ID,
    }
  );
}

/** Plain-English names of where the demo journey starts and ends, or null if the data has none. */
export function demoWalkNames(
  neighbourhood: Neighbourhood,
  journeys: readonly Journey[],
  demoJourneyId: string,
): WalkNames | null {
  const journey = journeys.find((j) => j.id === demoJourneyId);
  if (!journey) return null;
  const nameOf = (id: string) => neighbourhood.destinations.find((d) => d.id === id)?.name ?? null;
  return { from: nameOf(journey.originId), to: nameOf(journey.destinationId) };
}
