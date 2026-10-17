/**
 * Planner settings (tree spacing and species, longest covered walkway) applied to the area's
 * candidates. The adjusted candidates feed the optimiser, the map, the spec pack and the plan
 * explainer alike, so every figure the app shows comes from the same numbers.
 */
import { buildShelterSpec, generateTreeSpec } from '../features/fabrication/spec';
import type { Intervention, PathSegment, UnitCosts } from '../types';
import {
  SHELTER_LENGTH,
  SHELTER_SHADE,
  shelterPlanningCost,
  TREE_SPACING,
  treeCount,
  treePlanningCost,
  treeRowShade,
} from './planting';

export interface PlannerSettings {
  /** Metres between street trees along a row. */
  treeSpacingM: number;
  /** Index into `UnitCosts.speciesSuggestions`. */
  speciesIndex: number;
  /** Longest covered walkway to build; longer stretches are covered from their start. */
  maxShelterM: number;
}

export const DEFAULT_PLANNER: PlannerSettings = {
  treeSpacingM: TREE_SPACING.default,
  speciesIndex: 0,
  maxShelterM: SHELTER_LENGTH.max,
};

export interface PlannerContext {
  segments: readonly PathSegment[];
  lengthBySegment: ReadonlyMap<string, number>;
  unitCosts: UnitCosts;
}

const SHADE_DECIMALS = 100;
const TREES_IN_NAME = /\((\d+) trees?\)/;
const METRES_IN_NAME = /\(\d+ m\)/;

const hasDefaultTrees = (s: PlannerSettings): boolean =>
  s.treeSpacingM === DEFAULT_PLANNER.treeSpacingM && s.speciesIndex === DEFAULT_PLANNER.speciesIndex;

export const isDefaultPlanner = (s: PlannerSettings): boolean =>
  hasDefaultTrees(s) && s.maxShelterM >= DEFAULT_PLANNER.maxShelterM;

/** Total length of the path an intervention covers, in metres. */
export const coveredLengthM = (
  intervention: Pick<Intervention, 'segmentIds'>,
  lengthBySegment: ReadonlyMap<string, number>,
): number => intervention.segmentIds.reduce((sum, id) => sum + (lengthBySegment.get(id) ?? 0), 0);

/**
 * How many trees a row plants: the number its name states ("Trees on X (13 trees)"), which the
 * generator and the planner both derive from the row length and spacing; otherwise worked out.
 */
export function treesInRow(intervention: Pick<Intervention, 'name'>, rowM: number, spacingM: number): number {
  const stated = TREES_IN_NAME.exec(intervention.name)?.[1];
  return stated ? Number(stated) : treeCount(rowM, spacingM);
}

/** The length of a stretch a covered walkway actually covers under the planner settings. */
export const shelterBuiltLengthM = (stretchM: number, settings: PlannerSettings): number =>
  Math.min(stretchM, settings.maxShelterM);

function adjustTreeRow(tree: Intervention, settings: PlannerSettings, ctx: PlannerContext): Intervention {
  const rowM = coveredLengthM(tree, ctx.lengthBySegment);
  const species = ctx.unitCosts.speciesSuggestions[settings.speciesIndex];
  const spec = generateTreeSpec(tree, ctx.unitCosts, rowM, settings.treeSpacingM);
  const count = treeCount(rowM, settings.treeSpacingM);
  return {
    ...tree,
    name: tree.name.replace(TREES_IN_NAME, `(${count} ${count === 1 ? 'tree' : 'trees'})`),
    ...treePlanningCost(spec, ctx.unitCosts),
    ...treeRowShade(species, settings.treeSpacingM),
    yearsToMature: species?.yearsToMature ?? tree.yearsToMature,
  };
}

/**
 * A walkway capped below its stretch covers part of each path it runs along. Its shade is
 * spread over the stretch in proportion to the length it covers.
 */
function adjustShelter(shelter: Intervention, settings: PlannerSettings, ctx: PlannerContext): Intervention {
  const stretchM = coveredLengthM(shelter, ctx.lengthBySegment);
  const builtM = shelterBuiltLengthM(stretchM, settings);
  if (stretchM <= 0 || builtM >= stretchM) return shelter;
  const covered = ctx.segments.filter((s) => shelter.segmentIds.includes(s.id));
  const widthM = Math.max(0, ...covered.map((s) => s.widthM));
  const spec = buildShelterSpec(shelter, builtM, widthM, ctx.unitCosts);
  const shade = Math.round(((SHELTER_SHADE * builtM) / stretchM) * SHADE_DECIMALS) / SHADE_DECIMALS;
  return {
    ...shelter,
    name: shelter.name.replace(METRES_IN_NAME, `(${Math.round(builtM)} m)`),
    ...shelterPlanningCost(spec),
    shadeNow: shade,
    shadeFuture: shade,
  };
}

/**
 * Candidates as the planner set them up. Settings left at their defaults leave those candidates
 * exactly as the area data has them (and default settings return the area's own list).
 */
export function adjustInterventions(
  interventions: readonly Intervention[],
  settings: PlannerSettings,
  ctx: PlannerContext,
): readonly Intervention[] {
  if (isDefaultPlanner(settings)) return interventions;
  const treesChanged = !hasDefaultTrees(settings);
  return interventions.map((i) => {
    if (i.type === 'shelter') return adjustShelter(i, settings, ctx);
    return treesChanged ? adjustTreeRow(i, settings, ctx) : i;
  });
}
