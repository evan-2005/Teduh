import type { PathNode, PathSegment } from '../types';
import { segmentLengthM } from './geo';

export interface Edge {
  segmentId: string;
  to: string;
  lengthM: number;
}

export interface Graph {
  /** Undirected adjacency; blocked (`accessible === false`) segments are absent. */
  adjacency: ReadonlyMap<string, readonly Edge[]>;
  /** Length of every segment, including blocked ones (for display and metrics). */
  lengthBySegment: ReadonlyMap<string, number>;
}

export function buildGraph(
  nodes: readonly PathNode[],
  segments: readonly PathSegment[],
): Graph {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const lengthBySegment = new Map<string, number>();
  const adjacency = new Map<string, Edge[]>(nodes.map((n) => [n.id, []]));

  for (const segment of segments) {
    const lengthM = segmentLengthM(segment, nodesById);
    lengthBySegment.set(segment.id, lengthM);
    if (!segment.accessible) continue;
    adjacency.get(segment.from)?.push({ segmentId: segment.id, to: segment.to, lengthM });
    adjacency.get(segment.to)?.push({ segmentId: segment.id, to: segment.from, lengthM });
  }
  return { adjacency, lengthBySegment };
}
