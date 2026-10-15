import type { Scenario, TimeSlot } from './types';

// Placeholder Malaysian township coordinate. Teammate C supplies the real one.
export const MAP_CENTER: readonly [number, number] = [3.1075, 101.607];
export const MAP_ZOOM = 16;

export const WALK_SPEED_M_PER_MIN = 72; // 1.2 m/s
export const EXPOSED_THRESHOLD = 0.5; // segment is "exposed" if effective shade < 0.5
export const DEFAULT_DETOUR = 0.25;
export const MAX_CANDIDATES = 12; // 2^12 subsets is still instant
export const LAMBDA_SWEEP: readonly number[] = [10, 5, 3, 2, 1, 0.5, 0];

export const TIME_SLOTS: readonly TimeSlot[] = ['09:00', '12:00', '14:00', '17:00'];
export const MAX_CANOPY_YEAR = 10;

export const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Fraction of mature canopy reached `canopyYear` years after planting. */
export const treeGrowth = (canopyYear: number, yearsToMature: number): number =>
  yearsToMature <= 0 ? 1 : smoothstep(canopyYear / yearsToMature);

export const ENABLE_AI = import.meta.env.VITE_ENABLE_AI === 'true';

export const DEMO_BUDGET = 25_000;
export const DEMO_TIME: TimeSlot = '14:00';
export const DEMO_JOURNEY_ID = 'j-home-a-shops';

export const DEFAULT_SCENARIO: Scenario = {
  budget: DEMO_BUDGET,
  time: DEMO_TIME,
  canopy: 'now',
  canopyYear: 0,
  detourLimit: DEFAULT_DETOUR,
  priorityWeights: {},
  selectedInterventionIds: [],
  mapMode: 'swipe',
};

export const FOOTER_DISCLAIMER =
  'Illustrative prototype data. Not measurements or promised results.';
export const FABRICATION_DISCLAIMER =
  'Indicative only. Requires qualified engineer sign-off and site/utility checks.';
