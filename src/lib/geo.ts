import type { PathNode, PathSegment } from '../types';

const EARTH_RADIUS_M = 6_371_000;

interface LatLng { lat: number; lng: number }

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Segment length: the stated `lengthM` if present, else computed from node coordinates. */
export function segmentLengthM(
  segment: PathSegment,
  nodesById: ReadonlyMap<string, PathNode>,
): number {
  if (segment.lengthM !== undefined) return segment.lengthM;
  const from = nodesById.get(segment.from);
  const to = nodesById.get(segment.to);
  if (!from || !to) {
    throw new Error(`Segment ${segment.id} references an unknown node`);
  }
  return haversineM(from, to);
}
