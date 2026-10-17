import { describe, expect, test } from 'vitest';
import { loadDataset } from '../data/load';
import { generateTreeSpec } from '../features/fabrication/spec';
import { buildGraph } from './graph';
import {
  adjustInterventions,
  coveredLengthM,
  DEFAULT_PLANNER,
  isDefaultPlanner,
  shelterBuiltLengthM,
  treesInRow,
} from './planner';
import { SHELTER_SHADE, treeCount, treePlanningCost, treeRowShade, TREE_SHADE_FUTURE } from './planting';

const area = await loadDataset('ss15-subang-jaya');
const graph = buildGraph(area.neighbourhood.nodes, area.neighbourhood.segments);
const ctx = {
  segments: area.neighbourhood.segments,
  lengthBySegment: graph.lengthBySegment,
  unitCosts: area.unitCosts,
};
const trees = area.interventions.filter((i) => i.type === 'tree');
const shelters = area.interventions.filter((i) => i.type === 'shelter');
const countInName = (name: string): number => Number(/\((\d+) trees\)/.exec(name)?.[1]);

describe('adjustInterventions', () => {
  test('default settings return the area list itself', () => {
    expect(isDefaultPlanner(DEFAULT_PLANNER)).toBe(true);
    expect(adjustInterventions(area.interventions, DEFAULT_PLANNER, ctx)).toBe(area.interventions);
  });

  test('recomputing a row at the default spacing reproduces the shipped figures', () => {
    for (const tree of trees) {
      const rowM = coveredLengthM(tree, graph.lengthBySegment);
      const cost = treePlanningCost(generateTreeSpec(tree, area.unitCosts, rowM), area.unitCosts);
      expect(cost).toEqual({ installCost: tree.installCost, annualMaintenance: tree.annualMaintenance });
      expect(treeCount(rowM)).toBe(countInName(tree.name));
    }
  });

  test('closer spacing plants more trees, costs more, and the name says how many', () => {
    const closer = adjustInterventions(area.interventions, { ...DEFAULT_PLANNER, treeSpacingM: 6 }, ctx);
    for (const tree of trees) {
      const after = closer.find((i) => i.id === tree.id)!;
      const rowM = coveredLengthM(tree, graph.lengthBySegment);
      expect(countInName(after.name)).toBe(treeCount(rowM, 6));
      expect(countInName(after.name)).toBeGreaterThanOrEqual(countInName(tree.name));
      expect(after.installCost).toBeGreaterThanOrEqual(tree.installCost);
    }
    expect(closer.filter((i) => i.type === 'shelter')).toEqual(shelters);
  });

  test('a species with a narrow crown at wide spacing gives less shade at maturity', () => {
    const cassia = area.unitCosts.speciesSuggestions.findIndex((s) => s.matureCanopyM < 8);
    const wide = adjustInterventions(
      area.interventions,
      { ...DEFAULT_PLANNER, treeSpacingM: 10, speciesIndex: cassia },
      ctx,
    );
    const row = wide.find((i) => i.type === 'tree')!;
    expect(row.shadeFuture).toBeLessThan(TREE_SHADE_FUTURE);
    expect(row.yearsToMature).toBe(area.unitCosts.speciesSuggestions[cassia]!.yearsToMature);
  });

  test('capping walkway length shortens long stretches, prices them and spreads the shade', () => {
    const capped = adjustInterventions(area.interventions, { ...DEFAULT_PLANNER, maxShelterM: 40 }, ctx);
    for (const shelter of shelters) {
      const after = capped.find((i) => i.id === shelter.id)!;
      const stretchM = coveredLengthM(shelter, graph.lengthBySegment);
      if (stretchM <= 40) {
        expect(after).toBe(shelter);
        continue;
      }
      expect(after.name).toContain('(40 m)');
      expect(after.installCost).toBeLessThan(shelter.installCost);
      expect(after.shadeNow).toBeCloseTo((SHELTER_SHADE * 40) / stretchM, 2);
    }
    expect(capped.filter((i) => i.type === 'tree')).toEqual(trees);
  });
});

describe('planting rules', () => {
  test('the default species at 8 m gives the generator figures', () => {
    expect(treeRowShade(area.unitCosts.speciesSuggestions[0], 8)).toEqual({ shadeNow: 0.2, shadeFuture: 0.75 });
  });

  test('a walkway never covers more than its stretch', () => {
    expect(shelterBuiltLengthM(30, DEFAULT_PLANNER)).toBe(30);
    expect(shelterBuiltLengthM(90, { ...DEFAULT_PLANNER, maxShelterM: 50 })).toBe(50);
  });

  test('a row draws the number of trees its name states, or works it out', () => {
    expect(treesInRow({ name: 'Trees on SS 15/8A Road, SE (13 trees)' }, 50, 8)).toBe(13);
    expect(treesInRow({ name: 'Street tree by the school' }, 50, 8)).toBe(7);
  });

  test('every row plants at least one tree', () => {
    expect(treeCount(0, 8)).toBe(1);
    expect(treeCount(104, 8)).toBe(13);
  });
});
