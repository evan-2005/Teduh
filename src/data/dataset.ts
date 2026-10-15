import { buildGraph } from '../lib/graph';
import { loadDataset } from './load';

// Loaded once at startup; throws a readable error if data/*.json is invalid.
export const dataset = loadDataset();
export const graph = buildGraph(dataset.neighbourhood.nodes, dataset.neighbourhood.segments);
