/**
 * Cross-section of a mapped path: how wide its carriageway or walkway is, and where street trees
 * and covered walkways go beside it. Path kinds come from the segment notes the data pipeline
 * writes ("Residential street: SS 15/8A Road"); an unknown kind is treated as a footpath.
 */
import type { PathSegment } from '../types';

export interface StreetProfile {
  /** Half the width of the path or carriageway: nothing is planted closer than this. */
  clearanceM: number;
  /** Distance from the centreline to the tree line along the footpath edge. */
  treeOffsetM: number;
  /** Fallback tree line where the footpath edge is built up: a kerb build-out. */
  kerbOffsetM: number;
  /** Distance from the centreline to the middle of the footpath a walkway covers. */
  walkwayOffsetM: number;
}

/** Planting strip between the kerb or path edge and the tree trunk. */
const VERGE_M = 0.8;
/** A kerb build-out puts the trunk this far past the carriageway or path edge. */
const KERB_BUILDOUT_M = 0.5;
/** Footpath beside a road, which a covered walkway shelters. */
const ROADSIDE_FOOTPATH_M = 1.8;

/** Half carriageway widths for roads, by the plain-English kind the pipeline writes. */
const ROAD_HALF_WIDTH_M: Readonly<Record<string, number>> = {
  'service lane': 2.5,
  'pedestrian street': 3,
  'residential street': 3.5,
  'local road': 3.5,
  'collector road': 5,
  'main road': 6.5,
};

/** "Residential street: SS 15/8A Road (covered)" -> "residential street". */
export const pathKind = (segment: Pick<PathSegment, 'notes'>): string =>
  (segment.notes ?? '').split(/[:(]/)[0]!.trim().toLowerCase();

export function streetProfile(segment: Pick<PathSegment, 'notes' | 'widthM'>): StreetProfile {
  const road = ROAD_HALF_WIDTH_M[pathKind(segment)];
  if (road === undefined) {
    const half = segment.widthM / 2;
    return { clearanceM: half, treeOffsetM: half + VERGE_M, kerbOffsetM: half + KERB_BUILDOUT_M, walkwayOffsetM: 0 };
  }
  return {
    clearanceM: road,
    treeOffsetM: road + VERGE_M,
    kerbOffsetM: road + KERB_BUILDOUT_M,
    walkwayOffsetM: road + VERGE_M + ROADSIDE_FOOTPATH_M / 2,
  };
}
