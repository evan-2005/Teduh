import { describe, expect, test } from 'vitest';
import { dataset, graph } from '../../data/dataset';
import { FABRICATION_DISCLAIMER } from '../../config';
import { shelterElevationSvg } from './elevation';
import { toCsv, toJson } from './export';
import {
  buildShelterSpec,
  generateShelterSpec,
  generateTreeSpec,
  MODULE_LENGTH_M,
  SHELTER_HEIGHT_M,
} from './spec';

const { unitCosts, interventions, neighbourhood } = dataset;
const shelter = interventions.find((i) => i.id === 'shelter-connector')!;
const tree = interventions.find((i) => i.id === 'tree-home-a')!;

describe('buildShelterSpec module and post counts', () => {
  test.each([
    [0, 1, 4],
    [3, 1, 4],
    [10, 4, 10],
    [240, 80, 162],
  ])('%d m -> %d modules, %d posts', (lengthM, modules, posts) => {
    const spec = buildShelterSpec(shelter, lengthM, 2.5, unitCosts);
    expect(spec.dimensions.modules).toBe(modules);
    expect(spec.dimensions.posts).toBe(posts);
    expect(spec.dimensions.footings).toBe(posts);
  });

  test('derives width, roof and gutter from the length', () => {
    const spec = buildShelterSpec(shelter, 10, 2.5, unitCosts);
    expect(spec.dimensions.widthM).toBeCloseTo(2.8);
    expect(spec.dimensions.roofAreaM2).toBeCloseTo(28);
    expect(spec.dimensions.gutterM).toBe(20);
    expect(spec.dimensions.heightM).toBe(SHELTER_HEIGHT_M);
    expect(MODULE_LENGTH_M).toBe(3);
  });
});

describe('bill of materials', () => {
  test('lines add up to the total, including contingency', () => {
    for (const spec of [buildShelterSpec(shelter, 240, 2.5, unitCosts), generateTreeSpec(tree, unitCosts)]) {
      const sum = spec.bom.reduce((s, l) => s + l.total, 0);
      expect(spec.totalCost).toBeCloseTo(sum, 1);
      expect(spec.bom.at(-1)!.item).toMatch(/Contingency \(10%\)/);
    }
  });

  test('each line total equals qty x unit cost', () => {
    const spec = buildShelterSpec(shelter, 30, 2, unitCosts);
    spec.bom.slice(0, -1).forEach((l) => expect(l.total).toBeCloseTo(l.qty * l.unitCost, 1));
  });

  test('every spec carries assumptions and the standard disclaimer', () => {
    const spec = generateTreeSpec(tree, unitCosts);
    expect(spec.assumptions.length).toBeGreaterThan(0);
    expect(spec.disclaimer).toBe(FABRICATION_DISCLAIMER);
  });

  test('throws a clear error when a unit cost is missing', () => {
    const broken = { ...unitCosts, items: {} };
    expect(() => buildShelterSpec(shelter, 10, 2, broken)).toThrow(/steelPost/);
  });
});

describe('generateShelterSpec', () => {
  test('sums covered segment lengths and uses the widest path', () => {
    const spec = generateShelterSpec(shelter, neighbourhood.segments, unitCosts, graph.lengthBySegment);
    expect(spec.dimensions.lengthM).toBeCloseTo(240, -1);
    expect(spec.dimensions.widthM).toBeCloseTo(2.8);
  });
});

describe('generateTreeSpec', () => {
  test('uses the 1.2 x 1.2 x 1.0 m pit and lists species to verify', () => {
    const spec = generateTreeSpec(tree, unitCosts);
    expect(spec.dimensions.soilVolumeM3).toBeCloseTo(1.44);
    expect(spec.assumptions.join(' ')).toMatch(/verify with the landscape team/);
  });
});

describe('export', () => {
  const spec = buildShelterSpec(shelter, 30, 2, unitCosts);

  test('CSV has a header and one row per BOM line', () => {
    const lines = toCsv(spec).trim().split('\n');
    expect(lines[0]).toBe('item,qty,unit,unitCost,total');
    expect(lines).toHaveLength(spec.bom.length + 1);
  });

  test('CSV quotes fields that contain commas', () => {
    const csv = toCsv({ ...spec, bom: [{ item: 'a, b', qty: 1, unit: 'x', unitCost: 1, total: 1 }] });
    expect(csv).toContain('"a, b"');
  });

  test('JSON round-trips', () => {
    expect(JSON.parse(toJson(spec)).interventionId).toBe(spec.interventionId);
  });
});

describe('shelterElevationSvg', () => {
  test('draws one post per grid line', () => {
    const spec = buildShelterSpec(shelter, 10, 2, unitCosts);
    const svg = shelterElevationSvg(spec);
    expect(svg.match(/class="post"/g)).toHaveLength(spec.dimensions.modules! + 1);
  });

  test('labels length and height', () => {
    const svg = shelterElevationSvg(buildShelterSpec(shelter, 10, 2, unitCosts));
    expect(svg).toContain('10.0 m (4 modules)');
    expect(svg).toContain('2.7 m');
    expect(svg.startsWith('<svg')).toBe(true);
  });
});
