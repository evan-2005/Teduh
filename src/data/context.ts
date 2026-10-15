import { z } from 'zod';
import type { AreaContext } from '../types';
import type { DatasetName } from './load';

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
const loaders = import.meta.glob<unknown>('../../data/*/context.json', { import: 'default' });

/** Read-only map layers for a dataset, or null when the dataset has none (e.g. the synthetic one). */
export async function loadContext(name: DatasetName): Promise<AreaContext | null> {
  const load = loaders[`../../data/${name}/context.json`];
  return load ? areaContextSchema.parse(await load()) : null;
}
