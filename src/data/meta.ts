import { DEMO_BUDGET, DEMO_JOURNEY_ID, MAP_CENTER } from '../config';
import type { DatasetMeta, Neighbourhood } from '../types';

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
