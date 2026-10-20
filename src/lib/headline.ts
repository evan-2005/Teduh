import type { Journey, PlanResult } from '../types';

const MINUTES_PER_HOUR = 60;

export interface WalkRow {
  journeyId: string;
  label: string;
  trips: number;
  sunBefore: number;
  sunAfter: number;
  minutesAvoided: number;
}

export interface HeadlineBreakdown {
  rows: WalkRow[];
  totalMinutes: number;
  totalHours: number;
}

/**
 * The headline, walk by walk: trips per day × (sun-minutes before − sun-minutes after), summed
 * and turned into hours. Unweighted, so it is the same figure as pedestrianSunMinutesAvoided.
 */
export function headlineBreakdown(
  plan: PlanResult,
  journeys: readonly Journey[],
  nameOf: (destinationId: string) => string,
): HeadlineBreakdown {
  const byId = new Map(journeys.map((j) => [j.id, j]));
  const rows = plan.journeys
    .flatMap((c) => {
      const journey = byId.get(c.journeyId);
      if (!journey) return [];
      const minutesAvoided = journey.dailyTrips * (c.before.sunMin - c.after.sunMin);
      return [{
        journeyId: c.journeyId,
        label: `${nameOf(journey.originId)} → ${nameOf(journey.destinationId)}`,
        trips: journey.dailyTrips,
        sunBefore: c.before.sunMin,
        sunAfter: c.after.sunMin,
        minutesAvoided,
      }];
    })
    .sort((a, b) => b.minutesAvoided - a.minutesAvoided);
  const totalMinutes = rows.reduce((sum, r) => sum + r.minutesAvoided, 0);
  return { rows, totalMinutes, totalHours: totalMinutes / MINUTES_PER_HOUR };
}
