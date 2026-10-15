import { dataset } from '../data/dataset';
import type { Intervention, PathSegment } from '../types';

export type LatLngTuple = [number, number];

const { nodes, segments } = dataset.neighbourhood;

export const nodeCoords = new Map<string, LatLngTuple>(nodes.map((n) => [n.id, [n.lat, n.lng]]));
export const segmentsById = new Map(segments.map((s) => [s.id, s]));

export const networkBounds: [LatLngTuple, LatLngTuple] = [
  [Math.min(...nodes.map((n) => n.lat)), Math.min(...nodes.map((n) => n.lng))],
  [Math.max(...nodes.map((n) => n.lat)), Math.max(...nodes.map((n) => n.lng))],
];

export const segmentPath = (s: PathSegment): LatLngTuple[] => [
  nodeCoords.get(s.from)!,
  nodeCoords.get(s.to)!,
];

/** Marker position: the average midpoint of the segments an intervention covers. */
export function interventionPosition(intervention: Intervention): LatLngTuple {
  const mids = intervention.segmentIds.map((id) => {
    const [a, b] = segmentPath(segmentsById.get(id)!);
    return [(a![0] + b![0]) / 2, (a![1] + b![1]) / 2] as LatLngTuple;
  });
  const count = mids.length;
  return [
    mids.reduce((sum, m) => sum + m[0], 0) / count,
    mids.reduce((sum, m) => sum + m[1], 0) / count,
  ];
}
