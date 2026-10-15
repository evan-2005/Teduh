const MINUTES_PER_HOUR = 60;

export const formatMyr = (amount: number): string =>
  `RM ${Math.round(amount).toLocaleString('en-US')}`;

/** Pedestrian time in direct sun, as hours once it is large enough to read that way. */
export function formatPedestrianSun(minutes: number): { value: string; unit: string } {
  if (minutes >= MINUTES_PER_HOUR) {
    return { value: (minutes / MINUTES_PER_HOUR).toFixed(1), unit: 'pedestrian-hours' };
  }
  return { value: String(Math.round(minutes)), unit: 'pedestrian-minutes' };
}

export const formatMultiplier = (weight: number): string => `×${weight.toFixed(1)}`;
