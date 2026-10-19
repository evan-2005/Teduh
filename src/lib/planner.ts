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
  /** Unit-cost item key (e.g. "sapling") -> the price the planner entered, in MYR per unit. */
  unitCosts: Readonly<Record<string, number>>;
  /** Intervention id -> a contractor quote that replaces its estimated install cost. */
  quotes: Readonly<Record<string, number>>;
}

export const DEFAULT_PLANNER: PlannerSettings = {
  treeSpacingM: TREE_SPACING.default,
  speciesIndex: 0,
  maxShelterM: SHELTER_LENGTH.max,
  unitCosts: {},
  quotes: {},
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

const hasDefaultUnitCosts = (s: PlannerSettings): boolean => Object.keys(s.unitCosts).length === 0;

/** Site-planning choices at their defaults (costs are judged separately). */
export const isDefaultSitePlanning = (s: PlannerSettings): boolean =>
  hasDefaultTrees(s) && s.maxShelterM >= DEFAULT_PLANNER.maxShelterM;

export const isDefaultPlanner = (s: PlannerSettings): boolean =>
  isDefaultSitePlanning(s) && hasDefaultUnitCosts(s) && Object.keys(s.quotes).length === 0;

/** The area's unit costs with the planner's own prices in place of the estimates. */
export function effectiveUnitCosts(base: UnitCosts, settings: Pick<PlannerSettings, 'unitCosts'>): UnitCosts {
  if (Object.keys(settings.unitCosts).length === 0) return base;
  const items = Object.fromEntries(
    Object.entries(base.items).map(([key, item]) => {
      const price = settings.unitCosts[key];
      return [key, price === undefined ? item : { ...item, unitCost: price }];
    }),
  );
  return { ...base, items };
}

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

/** A tree row priced (and, when the spacing or species changed, counted and shaded) afresh. */
function adjustTreeRow(tree: Intervention, settings: PlannerSettings, ctx: PlannerContext): Intervention {
  const rowM = coveredLengthM(tree, ctx.lengthBySegment);
  const unitCosts = effectiveUnitCosts(ctx.unitCosts, settings);
  const spec = generateTreeSpec(tree, unitCosts, rowM, settings.treeSpacingM);
  const priced = { ...tree, ...treePlanningCost(spec, unitCosts) };
  if (hasDefaultTrees(settings)) return priced;
  const species = ctx.unitCosts.speciesSuggestions[settings.speciesIndex];
  const count = treeCount(rowM, settings.treeSpacingM);
  return {
    ...priced,
    name: tree.name.replace(TREES_IN_NAME, `(${count} ${count === 1 ? 'tree' : 'trees'})`),
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
  const capped = stretchM > 0 && builtM < stretchM;
  if (!capped && hasDefaultUnitCosts(settings)) return shelter;
  const covered = ctx.segments.filter((s) => shelter.segmentIds.includes(s.id));
  const widthM = Math.max(0, ...covered.map((s) => s.widthM));
  const spec = buildShelterSpec(shelter, builtM, widthM, effectiveUnitCosts(ctx.unitCosts, settings));
  if (!capped) return { ...shelter, ...shelterPlanningCost(spec) };
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
  const treesChanged = !hasDefaultTrees(settings) || !hasDefaultUnitCosts(settings);
  return interventions.map((i) => {
    const adjusted = i.type === 'shelter' ? adjustShelter(i, settings, ctx) : treesChanged ? adjustTreeRow(i, settings, ctx) : i;
    return withQuote(adjusted, settings.quotes[i.id]);
  });
}

/** A contractor quote replaces the estimated install cost; upkeep stays estimated. */
const withQuote = (intervention: Intervention, quote: number | undefined): Intervention =>
  quote === undefined ? intervention : { ...intervention, installCost: quote };
