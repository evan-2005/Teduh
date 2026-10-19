import { describe, expect, test } from 'vitest';
import type { Building } from '../../data/osm/parse';
import { shopRowPlaces } from '../../data/osm/shopRows';

const square = (x: number, y: number): Building['ring'] => [[x, y], [x + 8, y], [x + 8, y + 8], [x, y + 8], [x, y]];
const block = (kind: string, count: number, x0: number): Building[] =>
  Array.from({ length: count }, (_, i) => ({ id: i, ring: square(x0 + i * 10, 10), heightM: 7, kind }) as Building);
const nodes = [{ node: { id: 'n-1' }, xy: [30, 0] as [number, number] }, { node: { id: 'n-2' }, xy: [900, 900] as [number, number] }];

describe('shop rows', () => {
  test('a block of shophouses becomes one place people walk to, snapped to the nearest path', () => {
    const [row, ...rest] = shopRowPlaces(block('retail', 8, 0), nodes);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({ kind: 'shops', role: 'attractor', label: 'Shop row', nodeId: 'n-1', weight: 1 });
  });

  test('a few shops, or houses, are not a shop row', () => {
    expect(shopRowPlaces(block('retail', 3, 0), nodes)).toEqual([]);
    expect(shopRowPlaces(block('house', 20, 0), nodes)).toEqual([]);
  });
});
