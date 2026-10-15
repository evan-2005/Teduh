import { buildGraph } from '../lib/graph';
import { datasetMeta } from './meta';
import { loadDataset, type DatasetName } from './load';

const requested = import.meta.env?.VITE_DATASET;

/** `osm` is the real-area dataset; `seed` is the synthetic fallback (used by the unit tests). */
export const DATASET_NAME: DatasetName = requested === 'seed' ? 'seed' : 'osm';

// Loaded once at startup; throws a readable error if the data files are invalid.
export const dataset = loadDataset(DATASET_NAME);
export const graph = buildGraph(dataset.neighbourhood.nodes, dataset.neighbourhood.segments);
export const meta = datasetMeta(dataset.neighbourhood);
