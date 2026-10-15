/**
 * Estimate how shaded a path segment is from mapped buildings, mapped trees and covered walkways,
 * using the real sun position. This is a model, not a measurement: everything it produces is
 * labelled "estimated" in the app.
 */
import type { TimeSlot } from '../../src/types';
import { distance, pointInPolygon, rayPolygonHit, type XY } from './geometry';
import type { Building } from './parse';

const RAD = Math.PI / 180;
const SAMPLE_SPACING_M = 3;
const MIN_ELEVATION_RAD = 8 * RAD; // below this the sun is too low to model reliably
const MAX_REACH_M = 80;
const CELL_M = 50;
const COVERED_SHADE = 0.95;
const SHADE_STEP = 0.05;
const TREE_CROWN_RADIUS_M = 3;
const TREE_HEIGHT_M = 6;
/** Malaysia is UTC+8, whatever its longitude suggests. */
export const MALAYSIA_UTC_OFFSET_H = 8;

export const SLOT_HOURS: Readonly<Record<TimeSlot, number>> = {
  '09:00': 9,
  '12:00': 12,
  '14:00': 14,
  '17:00': 17,
};

export interface Sun {
  /** Radians above the horizon. */
  elevation: number;
  /** Unit vector pointing from a point on the ground toward the sun (x east, y north). */
  direction: XY;
}

/** NOAA-style approximation, accurate to about a degree. `localHour` is clock time in `utcOffsetH`. */
export function sunPosition(
  latDeg: number,
  lngDeg: number,
  dayOfYear: number,
  localHour: number,
  utcOffsetH: number = MALAYSIA_UTC_OFFSET_H,
): Sun {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (localHour - 12) / 24);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const solarMinutes = localHour * 60 + equationOfTime + 4 * lngDeg - 60 * utcOffsetH;
  const hourAngle = (solarMinutes / 4 - 180) * RAD;
  const lat = latDeg * RAD;

  const sinElevation =
    Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)));
  const azimuth =
    Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat),
    ) + Math.PI;
  return { elevation, direction: [Math.sin(azimuth), Math.cos(azimuth)] };
}

interface Indexed extends Building {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Grid index so each sample only tests nearby buildings. */
export class BuildingIndex {
  private readonly cells = new Map<string, Indexed[]>();

  constructor(buildings: readonly Building[]) {
    for (const b of buildings) {
      const xs = b.ring.map((p) => p[0]);
      const ys = b.ring.map((p) => p[1]);
      const item: Indexed = {
        ...b,
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
      for (let cx = Math.floor(item.minX / CELL_M); cx <= Math.floor(item.maxX / CELL_M); cx++) {
        for (let cy = Math.floor(item.minY / CELL_M); cy <= Math.floor(item.maxY / CELL_M); cy++) {
          const key = `${cx},${cy}`;
          this.cells.set(key, [...(this.cells.get(key) ?? []), item]);
        }
      }
    }
  }

  near(a: XY, b: XY): Indexed[] {
    const found = new Set<Indexed>();
    const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
    const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    for (let cx = Math.floor(x0 / CELL_M); cx <= Math.floor(x1 / CELL_M); cx++) {
      for (let cy = Math.floor(y0 / CELL_M); cy <= Math.floor(y1 / CELL_M); cy++) {
        for (const item of this.cells.get(`${cx},${cy}`) ?? []) found.add(item);
      }
    }
    return [...found];
  }
}

export interface Casters {
  buildings: BuildingIndex;
  trees: readonly XY[];
}

/** Is the sun blocked at ground point `p` by a building, or is `p` under a tree's shadow? */
export function isShaded(p: XY, sun: Sun, casters: Casters): boolean {
  const tan = Math.tan(sun.elevation);
  const [dx, dy] = sun.direction;

  for (const tree of casters.trees) {
    const shadowCentre: XY = [
      tree[0] - dx * (TREE_HEIGHT_M / tan),
      tree[1] - dy * (TREE_HEIGHT_M / tan),
    ];
    if (distance(p, shadowCentre) <= TREE_CROWN_RADIUS_M) return true;
  }

  const end: XY = [p[0] + dx * MAX_REACH_M, p[1] + dy * MAX_REACH_M];
  for (const building of casters.buildings.near(p, end)) {
    if (pointInPolygon(p, building.ring)) continue;
    const reach = Math.min(MAX_REACH_M, building.heightM / tan);
    const hit = rayPolygonHit(p, sun.direction, building.ring, reach);
    if (hit !== null && building.heightM >= hit * tan) return true;
  }
  return false;
}

const quantise = (fraction: number): number =>
  Math.round(fraction / SHADE_STEP) * SHADE_STEP;

/** Shaded fraction (0..1, in steps of 0.05) of the straight segment a-b at one sun position. */
export function segmentShade(a: XY, b: XY, covered: boolean, sun: Sun | null, casters: Casters): number {
  if (covered) return COVERED_SHADE;
  if (!sun || sun.elevation < MIN_ELEVATION_RAD) return 0;
  const length = distance(a, b);
  const samples = Math.max(3, Math.ceil(length / SAMPLE_SPACING_M));
  let shaded = 0;
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) / samples;
    const p: XY = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (isShaded(p, sun, casters)) shaded += 1;
  }
  return Math.min(1, Math.max(0, Number(quantise(shaded / samples).toFixed(2))));
}
