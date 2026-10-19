/**
 * The tree rows and walkways a person placed, kept in this browser per area so they survive a
 * reload. Anything unreadable or pointing at paths the area no longer has is dropped.
 */
import { z } from 'zod';
import { MAX_CANDIDATES } from '../config';
import { AREA_ID, dataset } from '../data/dataset';
import { isUserPlaced } from '../lib/userPlacement';
import type { Intervention } from '../types';

const KEY = `teduh:user-items:${AREA_ID}`;
const knownSegments = new Set(dataset.neighbourhood.segments.map((s) => s.id));

const fraction = z.number().min(0).max(1);
const itemSchema = z.object({
  id: z.string().refine(isUserPlaced),
  type: z.enum(['tree', 'shelter']),
  name: z.string().min(1).max(200),
  segmentIds: z.array(z.string()).min(1).refine((ids) => ids.every((id) => knownSegments.has(id))),
  installCost: z.number().nonnegative(),
  annualMaintenance: z.number().nonnegative(),
  shadeNow: fraction,
  shadeFuture: fraction,
  yearsToMature: z.number().nonnegative(),
  feasibility: z.enum(['approved', 'likely', 'needs-check']),
  costSource: z.enum(['surveyed', 'estimated', 'ai-confirmed', 'missing']),
});

export function loadUserItems(): Intervention[] {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const items = raw.flatMap((item) => {
      const parsed = itemSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
    // The optimiser refuses more than MAX_CANDIDATES, so never load more than there is room for.
    return items.slice(0, Math.max(0, MAX_CANDIDATES - dataset.interventions.length));
  } catch {
    return [];
  }
}

export function saveUserItems(items: readonly Intervention[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage can be full or blocked (private windows); the items still work for this visit.
  }
}
