/**
 * Shop rows: where OpenStreetMap has the shophouses and commercial blocks but few tagged shops,
 * clusters of those buildings stand in for the shops, eateries and offices people walk to. Used
 * only as a fallback, for areas where the tagged places give too few walks.
 */
import type { Place } from './trips';
import { centroid, type XY } from './geometry';
import type { Building } from './parse';

const SHOP_BUILDINGS = new Set(['retail', 'commercial', 'office', 'supermarket', 'kiosk']);
/** Buildings are grouped in square cells of this size before nearby cells are merged. */
const CELL_M = 120;
const MIN_BUILDINGS_PER_ROW = 5;
const BUILDINGS_PER_WEIGHT = 8;
const MAX_ROW_WEIGHT = 5;
const MAX_SNAP_M = 80;

export const isShopBuilding = (b: Pick<Building, 'kind'>): boolean => SHOP_BUILDINGS.has(b.kind);

interface NodeXY { node: { id: string }; xy: XY }

function nearest(nodes: readonly NodeXY[], xy: XY): { id: string; distanceM: number } | null {
  let best: { id: string; distanceM: number } | null = null;
  for (const { node, xy: p } of nodes) {
    const d = Math.hypot(p[0] - xy[0], p[1] - xy[1]);
    if (!best || d < best.distanceM) best = { id: node.id, distanceM: d };
  }
  return best;
}

/** One "Shop row" place per cell with enough shop buildings, weighted by how many there are. */
export function shopRowPlaces(buildings: readonly Building[], nodes: readonly NodeXY[]): Place[] {
  const cells = new Map<string, XY[]>();
  for (const b of buildings.filter(isShopBuilding)) {
    const c = centroid(b.ring);
    const key = `${Math.floor(c[0] / CELL_M)},${Math.floor(c[1] / CELL_M)}`;
    cells.set(key, [...(cells.get(key) ?? []), c]);
  }
  return [...cells.values()]
    .filter((points) => points.length >= MIN_BUILDINGS_PER_ROW)
    .sort((a, b) => b.length - a.length)
    .flatMap((points, index) => {
      const xy = centroid(points);
      const snap = nearest(nodes, xy);
      if (!snap || snap.distanceM > MAX_SNAP_M) return [];
      const place: Place = {
        id: `shop-row-${index + 1}`,
        kind: 'shops',
        role: 'attractor',
        label: 'Shop row',
        nodeId: snap.id,
        xy,
        weight: Math.min(MAX_ROW_WEIGHT, points.length / BUILDINGS_PER_WEIGHT),
      };
      return [place];
    });
}
