import { treeGrowth } from '../config';
import type {
  CanopyMode,
  ClockTime,
  Intervention,
  PathSegment,
  ShadeOverride,
  TimeSlot,
} from '../types';
import { valueAt } from './clock';

/** Effective shade (0..1) per segment id. */
export type ShadeLookup = ReadonlyMap<string, number>;

export interface ShadeParams {
  time: ClockTime;
  canopy: CanopyMode;
  canopyYear: number;
  /** Only the interventions that are applied (selected or part of a plan). */
  interventions: readonly Intervention[];
  overrides: readonly ShadeOverride[];
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shade an intervention provides under the current canopy settings. */
export function interventionShade(
  intervention: Intervention,
  canopy: CanopyMode,
  canopyYear: number,
): number {
  if (canopy === 'now') return intervention.shadeNow;
  const growth = treeGrowth(canopyYear, intervention.yearsToMature);
  return lerp(intervention.shadeNow, intervention.shadeFuture, growth);
}

/** base = override ?? survey snapshot (interpolated between snapshot times); then the max with every covering intervention. */
export function effectiveShade(segment: PathSegment, params: ShadeParams): number {
  const atSlot = (slot: TimeSlot): number =>
    params.overrides.find((o) => o.segmentId === segment.id && o.time === slot)?.shade ?? segment.shade[slot];
  let shade = valueAt(atSlot, params.time);
  for (const intervention of params.interventions) {
    if (!intervention.segmentIds.includes(segment.id)) continue;
    shade = Math.max(shade, interventionShade(intervention, params.canopy, params.canopyYear));
  }
  return shade;
}

export function buildShadeLookup(
  segments: readonly PathSegment[],
  params: ShadeParams,
): ShadeLookup {
  return new Map(segments.map((s) => [s.id, effectiveShade(s, params)]));
}
