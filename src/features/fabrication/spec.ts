import { FABRICATION_DISCLAIMER } from '../../config';
import type {
  BomLine,
  FabricationSpec,
  Intervention,
  PathSegment,
  UnitCosts,
} from '../../types';

export const MODULE_LENGTH_M = 3;
export const SHELTER_HEIGHT_M = 2.7;
export const ROOF_OVERHANG_M = 0.3;

const FOOTING_VOLUME_M3 = 0.5 * 0.5 * 0.8;
const PURLIN_RUNS = 3;
const MODULES_PER_LABOUR_DAY = 2;
const TREE_PIT = { lengthM: 1.2, widthM: 1.2, depthM: 1.0 } as const;
const TREE_STAKES = 3;
const MAINTENANCE_MONTHS = 24;
const CENTS = 100;

const round2 = (value: number): number => Math.round(value * CENTS) / CENTS;

function bomLine(unitCosts: UnitCosts, key: string, qty: number): BomLine {
  const item = unitCosts.items[key];
  if (!item) throw new Error(`data/unit-costs.json is missing the "${key}" item`);
  return {
    item: item.label,
    qty: round2(qty),
    unit: item.unit,
    unitCost: item.unitCost,
    total: round2(qty * item.unitCost),
  };
}

/** Append the contingency line and total up a bill of materials. */
function withContingency(
  lines: readonly BomLine[],
  rate: number,
): { bom: BomLine[]; totalCost: number } {
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const contingency = round2(subtotal * rate);
  const line: BomLine = {
    item: `Contingency (${Math.round(rate * 100)}%)`,
    qty: 1,
    unit: 'lot',
    unitCost: contingency,
    total: contingency,
  };
  return { bom: [...lines, line], totalCost: round2(subtotal + contingency) };
}

/** Shelter spec for a covered length. Modules are 3 m, so even 0 m needs one module. */
export function buildShelterSpec(
  intervention: Intervention,
  lengthM: number,
  pathWidthM: number,
  unitCosts: UnitCosts,
): FabricationSpec {
  const modules = Math.max(1, Math.ceil(lengthM / MODULE_LENGTH_M));
  const posts = (modules + 1) * 2;
  const widthM = round2(pathWidthM + ROOF_OVERHANG_M);
  const roofAreaM2 = round2(lengthM * widthM);
  const gutterM = round2(lengthM * 2);
  const framingM = round2(PURLIN_RUNS * lengthM + (modules + 1) * widthM);
  const labourDays = Math.max(1, Math.ceil(modules / MODULES_PER_LABOUR_DAY));

  const { bom, totalCost } = withContingency(
    [
      bomLine(unitCosts, 'steelPost', posts),
      bomLine(unitCosts, 'rafterPurlin', framingM),
      bomLine(unitCosts, 'roofSheet', roofAreaM2),
      bomLine(unitCosts, 'gutter', gutterM),
      bomLine(unitCosts, 'concrete', posts * FOOTING_VOLUME_M3),
      bomLine(unitCosts, 'fixings', posts),
      bomLine(unitCosts, 'labourDay', labourDays),
    ],
    unitCosts.contingencyRate,
  );

  return {
    interventionId: intervention.id,
    type: 'shelter',
    dimensions: {
      lengthM: round2(lengthM),
      widthM,
      heightM: SHELTER_HEIGHT_M,
      modules,
      posts,
      footings: posts,
      roofAreaM2,
      gutterM,
    },
    bom,
    totalCost,
    assumptions: [
      `Modules of ${MODULE_LENGTH_M} m; two posts per grid line; one footing per post.`,
      `Roof width = widest path (${pathWidthM} m) plus ${ROOF_OVERHANG_M} m overhang; clear height ${SHELTER_HEIGHT_M} m.`,
      `Footings assumed 0.5 x 0.5 x 0.8 m; ${PURLIN_RUNS} purlin runs along the length.`,
      `Labour assumes ${MODULES_PER_LABOUR_DAY} modules per crew-day.`,
      `Unit costs are ${unitCosts.costSource} (${unitCosts.currency}), not contractor quotes.`,
    ],
    disclaimer: FABRICATION_DISCLAIMER,
  };
}

/** Tree spec: planting pit, materials and a two-year care plan, with species to verify. */
export function generateTreeSpec(intervention: Intervention, unitCosts: UnitCosts): FabricationSpec {
  const pitVolumeM3 = TREE_PIT.lengthM * TREE_PIT.widthM * TREE_PIT.depthM;
  const barrierM = 2 * (TREE_PIT.lengthM + TREE_PIT.widthM);

  const { bom, totalCost } = withContingency(
    [
      bomLine(unitCosts, 'sapling', 1),
      bomLine(unitCosts, 'soilMix', pitVolumeM3),
      bomLine(unitCosts, 'rootBarrier', barrierM),
      bomLine(unitCosts, 'treeGuard', 1),
      bomLine(unitCosts, 'stake', TREE_STAKES),
      bomLine(unitCosts, 'maintenanceVisit', MAINTENANCE_MONTHS),
    ],
    unitCosts.contingencyRate,
  );

  const species = unitCosts.speciesSuggestions
    .map((s) => `${s.name} (canopy ~${s.matureCanopyM} m, ~${s.yearsToMature} yrs)`)
    .join('; ');

  return {
    interventionId: intervention.id,
    type: 'tree',
    dimensions: {
      pitLengthM: TREE_PIT.lengthM,
      pitWidthM: TREE_PIT.widthM,
      pitDepthM: TREE_PIT.depthM,
      soilVolumeM3: round2(pitVolumeM3),
      rootBarrierM: round2(barrierM),
      stakes: TREE_STAKES,
      maintenanceVisits: MAINTENANCE_MONTHS,
    },
    bom,
    totalCost,
    assumptions: [
      `Pit ${TREE_PIT.lengthM} x ${TREE_PIT.widthM} x ${TREE_PIT.depthM} m, backfilled with soil mix.`,
      `Two-year care plan: one visit a month (${MAINTENANCE_MONTHS} visits).`,
      `Suggested species, to verify with the landscape team: ${species || 'none listed'}.`,
      `Unit costs are ${unitCosts.costSource} (${unitCosts.currency}), not contractor quotes.`,
    ],
    disclaimer: FABRICATION_DISCLAIMER,
  };
}

/** Shelter spec from the segments an intervention covers. */
export function generateShelterSpec(
  intervention: Intervention,
  segments: readonly PathSegment[],
  unitCosts: UnitCosts,
  lengthBySegment: ReadonlyMap<string, number>,
): FabricationSpec {
  const covered = segments.filter((s) => intervention.segmentIds.includes(s.id));
  const lengthM = covered.reduce(
    (sum, s) => sum + (lengthBySegment.get(s.id) ?? s.lengthM ?? 0),
    0,
  );
  const pathWidthM = Math.max(0, ...covered.map((s) => s.widthM));
  return buildShelterSpec(intervention, lengthM, pathWidthM, unitCosts);
}
