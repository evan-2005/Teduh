import { dataset, graph } from '../data/dataset';
import { createPlantingLayout } from '../lib/plantingLayout';

/** Tree and walkway positions for the loaded area. */
export const { treePositions, walkwayLine } = createPlantingLayout(dataset.neighbourhood, graph.lengthBySegment);
