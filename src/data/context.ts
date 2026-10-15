import { z } from 'zod';
import type { AreaContext } from '../types';
import { loadCustomArea } from './customAreas';
import { CUSTOM_PREFIX, type AreaId } from './load';

const point = z.tuple([z.number(), z.number()]);

export const areaContextSchema = z.object({
  buildings: z.array(z.array(point).min(3)),
  greens: z.array(
    z.object({
      kind: z.enum(['park', 'playground', 'pitch', 'garden']),
      ring: z.array(point).min(3),
    }),
  ),
  landmarks: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['school', 'bus-stop', 'shops', 'food', 'worship', 'health', 'park', 'other']),
      name: z.string(),
      localName: z.string().optional(),
      lat: z.number(),
      lng: z.number(),
    }),
  ),
  trees: z.array(point),
});

// Lazy: the (larger) context file is only fetched when the map needs it.
const loaders = import.meta.glob<unknown>('../../data/areas/*/context.json', { import: 'default' });

/** Read-only map layers for an area, or null when it has none (e.g. the invented dataset). */
export async function loadContext(id: AreaId): Promise<AreaContext | null> {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const saved = loadCustomArea(id.slice(CUSTOM_PREFIX.length));
    return saved ? areaContextSchema.parse(saved.context) : null;
  }
  const load = loaders[`../../data/areas/${id}/context.json`];
  return load ? areaContextSchema.parse(await load()) : null;
}
