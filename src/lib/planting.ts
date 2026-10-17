/**
 * Planting and shelter rules shared by the data pipeline (data/osm/candidates.ts) and the
 * planner controls, so a candidate's cost, shade and name are worked out the same way in both.
 */
import type { FabricationSpec, SpeciesSuggestion, UnitCosts } from '../types';

/** Street-tree spacing along a row, in metres (urban street-tree practice: about 6 to 10 m). */
export const TREE_SPACING = { min: 6, max: 10, default: 8, step: 1 } as const;

/** Shade a covered walkway gives the path under it. */
export const SHELTER_SHADE = 0.95;
/** Shade from a row of young street trees, and from the same row at maturity (8 m spacing). */
export const TREE_SHADE_NOW = 0.2;
export const TREE_SHADE_FUTURE = 0.75;
export const TREE_YEARS_TO_MATURE = 6;
/** The canopy width the default shade figures assume (the first suggested species). */
const REFERENCE_CANOPY_M = 8;

/** Longest covered walkway the generator proposes, and the planner's shortest. */
export const SHELTER_LENGTH = { min: 20, max: 100, step: 10 } as const;

const SHELTER_COST_STEP = 1000;
const TREE_COST_STEP = 100;
const SHELTER_UPKEEP_RATE = 0.025;
const UPKEEP_STEP = 10;
/** Saplings need care for two years; half of that is the planning figure per year. */
const TREE_CARE_YEARS = 2;
const SHADE_DECIMALS = 100;

export const roundTo = (value: number, step: number): number =>
  Math.max(step, Math.round(value / step) * step);

const roundShade = (value: number): number => Math.round(value * SHADE_DECIMALS) / SHADE_DECIMALS;

export interface PlanningCost {
  installCost: number;
  annualMaintenance: number;
}

/** Planning figures for a covered walkway, rounded from its bill of materials. */
export function shelterPlanningCost(spec: FabricationSpec): PlanningCost {
  const installCost = roundTo(spec.totalCost, SHELTER_COST_STEP);
  return { installCost, annualMaintenance: roundTo(installCost * SHELTER_UPKEEP_RATE, UPKEEP_STEP) };
}

/** Planning figures for a tree row: install cost from its bill, upkeep from its care visits. */
export function treePlanningCost(spec: FabricationSpec, unitCosts: UnitCosts): PlanningCost {
  const careLabel = unitCosts.items['maintenanceVisit']?.label;
  const careLine = spec.bom.find((l) => l.item === careLabel);
  return {
    installCost: roundTo(spec.totalCost, TREE_COST_STEP),
    annualMaintenance: roundTo((careLine?.total ?? 0) / TREE_CARE_YEARS, UPKEEP_STEP),
  };
}

/** Trees in a row of this length at this spacing: one per spacing, never fewer than one. */
export const treeCount = (rowLengthM: number, spacingM: number = TREE_SPACING.default): number =>
  Math.max(1, Math.ceil(rowLengthM / spacingM));

/**
 * Shade from a tree row for a species and spacing. Crowns that meet (canopy at least the
 * spacing) give the full figure; wider gaps give proportionally less. The default species at
 * 8 m spacing gives exactly the generator's figures.
 */
export function treeRowShade(
  species: Pick<SpeciesSuggestion, 'matureCanopyM'> | undefined,
  spacingM: number,
): { shadeNow: number; shadeFuture: number } {
  const canopyM = species?.matureCanopyM ?? REFERENCE_CANOPY_M;
  const cover = Math.min(1, canopyM / spacingM);
  const referenceCover = Math.min(1, REFERENCE_CANOPY_M / TREE_SPACING.default);
  const shadeFuture = roundShade((TREE_SHADE_FUTURE * cover) / referenceCover);
  const youngCover = Math.min(1, TREE_SPACING.default / spacingM);
  return { shadeNow: roundShade(Math.min(shadeFuture, TREE_SHADE_NOW * youngCover)), shadeFuture };
}
