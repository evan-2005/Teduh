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

/** ×1.0, ×2.5, ×1.25: one decimal unless the weight needs two. */
export const formatMultiplier = (weight: number): string =>
  `×${Number.isInteger(weight * 10) ? weight.toFixed(1) : weight.toFixed(2)}`;

const NOON = 12;

/** '14:00' -> '2 pm', '09:00' -> '9 am', '12:00' -> '12 pm'. */
export function formatClock(time: string): string {
  const [hourText = '0', minuteText = '00'] = time.split(':');
  const hour = Number(hourText);
  const suffix = hour >= NOON ? 'pm' : 'am';
  const hour12 = hour % NOON === 0 ? NOON : hour % NOON;
  return minuteText === '00' ? `${hour12} ${suffix}` : `${hour12}:${minuteText} ${suffix}`;
}

/** "Bus stop" -> "bus stop" for running text, but leave acronyms such as "LRT station" alone. */
const inSentence = (name: string): string =>
  /^[A-Z][A-Z]/.test(name) ? name : `${name.charAt(0).toLowerCase()}${name.slice(1)}`;

/** "the bus stop", but "homes (east)": a group of homes takes no article. */
const withArticle = (name: string): string =>
  /^homes\b/i.test(name) ? inSentence(name) : `the ${inSentence(name)}`;

export interface WalkNames {
  from: string | null;
  to: string | null;
}

/** Button text for the demo preset, e.g. "Demo: 2 pm walk from the LRT station to the shopping mall". */
export function demoLabel(time: string, walk: WalkNames | null): string {
  const clock = formatClock(time);
  if (!walk?.to) return `Demo: ${clock} walk to a nearby place`;
  const from = walk.from ? ` from ${withArticle(walk.from)}` : '';
  return `Demo: ${clock} walk${from} to ${withArticle(walk.to)}`;
}
