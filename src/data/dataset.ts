import { buildGraph } from '../lib/graph';
import { DEFAULT_AREA_ID } from './areas';
import { loadDataset, type AreaId, type Dataset } from './load';
import { datasetMeta } from './meta';

/** `?area=<slug>` picks an area; `VITE_DATASET=seed` forces the invented one (used by tests). */
function requestedArea(): AreaId {
  if (import.meta.env?.VITE_DATASET === 'seed') return 'seed';
  const fromUrl = globalThis.location
    ? new URLSearchParams(globalThis.location.search).get('area')
    : null;
  return fromUrl ?? DEFAULT_AREA_ID;
}

async function loadWithFallback(id: AreaId): Promise<{ id: AreaId; data: Dataset }> {
  try {
    return { id, data: await loadDataset(id) };
  } catch (error) {
    if (id === DEFAULT_AREA_ID) throw error;
    // An unknown or removed area (for example an old bookmark): fall back to the default.
    return { id: DEFAULT_AREA_ID, data: await loadDataset(DEFAULT_AREA_ID) };
  }
}

const loaded = await loadWithFallback(requestedArea());

/** The id of the area that is actually loaded. */
export const AREA_ID: AreaId = loaded.id;
export const dataset: Dataset = loaded.data;
export const graph = buildGraph(dataset.neighbourhood.nodes, dataset.neighbourhood.segments);
export const meta = datasetMeta(dataset.neighbourhood);
