/**
 * Times of day. Shade is surveyed (or modelled) at four snapshot times; any time in between is
 * read by straight-line interpolation between the two snapshots either side of it.
 */
import { TIME_SLOTS } from '../config';
import type { ClockTime, TimeSlot } from '../types';

const MINUTES_PER_HOUR = 60;
const PAD = 2;

/** "14:30" -> 870. */
export function minutesOf(time: ClockTime): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}

/** 870 -> "14:30". */
export const clockOf = (minutes: number): ClockTime =>
  `${String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(PAD, '0')}:${String(minutes % MINUTES_PER_HOUR).padStart(PAD, '0')}`;

const SLOT_MINUTES = TIME_SLOTS.map((slot) => ({ slot, minutes: minutesOf(slot) }));

/** True when the time is one of the snapshot times. */
export const isSlot = (time: ClockTime): time is TimeSlot => TIME_SLOTS.includes(time as TimeSlot);

/** The snapshot time closest to `time` (earlier one on a tie). */
export function nearestSlot(time: ClockTime): TimeSlot {
  const t = minutesOf(time);
  return SLOT_MINUTES.reduce((best, s) => (Math.abs(s.minutes - t) < Math.abs(best.minutes - t) ? s : best)).slot;
}

/**
 * The value at `time` from values at the snapshot times: exact at a snapshot, interpolated
 * between two, and held at the first or last snapshot outside their range.
 */
export function valueAt(values: (slot: TimeSlot) => number, time: ClockTime): number {
  const t = minutesOf(time);
  const first = SLOT_MINUTES[0]!;
  const last = SLOT_MINUTES.at(-1)!;
  if (t <= first.minutes) return values(first.slot);
  if (t >= last.minutes) return values(last.slot);
  const after = SLOT_MINUTES.findIndex((s) => s.minutes >= t);
  const hi = SLOT_MINUTES[after]!;
  const lo = SLOT_MINUTES[after - 1]!;
  const f = (t - lo.minutes) / (hi.minutes - lo.minutes);
  return values(lo.slot) + (values(hi.slot) - values(lo.slot)) * f;
}
