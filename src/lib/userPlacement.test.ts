import { describe, expect, test } from 'vitest';
import { loadDataset } from '../data/load';
import { buildGraph } from './graph';
import { coveredLengthM } from './planner';
import { treeCount } from './planting';
import { createUserIntervention, isUserPlaced, streetOf, togglePath } from './userPlacement';

const area = await loadDataset('ss15-subang-jaya');
const graph = buildGraph(area.neighbourhood.nodes, area.neighbourhood.segments);
const segmentsById = new Map(area.neighbourhood.segments.map((s) => [s.id, s]));
const ctx = { segmentsById, lengthBySegment: graph.lengthBySegment, unitCosts: area.unitCosts };
/** A generated tree row: real, connected paths with a known count and cost. */
const row = area.interventions.find((i) => i.type === 'tree' && i.segmentIds.length > 1)!;

describe('picking paths', () => {
  test('adds connected paths and removes a picked one', () => {
    const [first, second] = row.segmentIds as [string, string];
    const picked = togglePath(togglePath([], first, segmentsById), second, segmentsById);
    expect(picked).toEqual([first, second]);
    expect(togglePath(picked, first, segmentsById)).toEqual([second]);
  });

  test('taking out a middle path keeps one connected stretch', () => {
    const long = area.interventions.find((i) => i.segmentIds.length >= 3)!;
    const picked = long.segmentIds.reduce<string[]>((run, id) => togglePath(run, id, segmentsById), []);
    expect(picked).toEqual(long.segmentIds);
    const middle = picked[1]!;
    const after = togglePath(picked, middle, segmentsById);
    expect(after).not.toContain(middle);
    // Every remaining path touches another one: no gap where the middle was.
    const ends = (id: string) => [segmentsById.get(id)!.from, segmentsById.get(id)!.to];
    if (after.length > 1) {
      after.forEach((id) =>
        expect(after.some((other) => other !== id && ends(other).some((n) => ends(id).includes(n)))).toBe(true),
      );
    }
    expect(after.length).toBeGreaterThanOrEqual(Math.ceil((picked.length - 1) / 2));
  });

  test('a path that does not touch the run starts a new one', () => {
    const far = area.neighbourhood.segments.find(
      (s) => !row.segmentIds.some((id) => [segmentsById.get(id)!.from, segmentsById.get(id)!.to].some((n) => n === s.from || n === s.to)),
    )!;
    expect(togglePath([row.segmentIds[0]!], far.id, segmentsById)).toEqual([far.id]);
  });

  test('names the street most picked paths are on', () => {
    expect(row.name).toContain(streetOf(row.segmentIds, segmentsById).replace(/^a /, ''));
  });
});

describe('your own tree rows and walkways', () => {
  test('a tree row along the same paths costs what the generated one does', () => {
    const yours = createUserIntervention('tree', row.segmentIds, 1, ctx);
    expect(isUserPlaced(yours.id)).toBe(true);
    expect(yours.installCost).toBe(row.installCost);
    expect(yours.annualMaintenance).toBe(row.annualMaintenance);
    expect(yours.name).toContain(`(${treeCount(coveredLengthM(row, graph.lengthBySegment))} trees)`);
  });

  test('a walkway along the paths of a generated one costs the same', () => {
    const shelter = area.interventions.find((i) => i.type === 'shelter')!;
    const yours = createUserIntervention('shelter', shelter.segmentIds, 2, ctx);
    expect(yours.installCost).toBe(shelter.installCost);
    expect(yours.shadeNow).toBe(shelter.shadeNow);
    expect(yours.name).toMatch(/^Your covered walkway on .+ \(\d+ m\)$/);
  });
});
