/** Build a routable path network from mapped walkable ways. */
import { distance, simplify, splitEvenly, type XY } from './geometry';
import { englishStreetName, type Highway } from './parse';

export interface NetNode { id: string; xy: XY }
export interface NetSegment {
  id: string;
  from: string;
  to: string;
  lengthM: number;
  highway: string;
  /** English street name when the source has one. */
  name?: string;
  covered: boolean;
  widthM: number;
}
export interface Network { nodes: NetNode[]; segments: NetSegment[] }

export interface NetworkOptions {
  /** Drop anything farther than this from the origin (0, 0). */
  radiusM: number;
  maxSegmentM: number;
  simplifyToleranceM: number;
  /** Dead-end stubs shorter than this are removed. */
  minStubM: number;
}

export const DEFAULT_NETWORK_OPTIONS: NetworkOptions = {
  radiusM: 450,
  maxSegmentM: 80,
  simplifyToleranceM: 4,
  minStubM: 20,
};

const WIDTH_BY_HIGHWAY: Readonly<Record<string, number>> = {
  footway: 1.8, path: 1.8, steps: 1.8, cycleway: 1.8, track: 2,
  pedestrian: 3, service: 3, residential: 2.5, living_street: 2.5, unclassified: 2.5,
  tertiary: 2, secondary: 2, primary: 2,
};
const COVERED_VALUES = new Set(['yes', 'arcade']);

interface RawEdge {
  a: number;
  b: number;
  lengthM: number;
  attr: string;
  highway: string;
  name?: string;
  covered: boolean;
  points: [XY, XY];
}

const keyOf = (p: XY): string => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;

function collectEdges(highways: readonly Highway[], radiusM: number): { vertices: XY[]; edges: RawEdge[] } {
  const vertices: XY[] = [];
  const ids = new Map<string, number>();
  const vertexOf = (p: XY): number => {
    const key = keyOf(p);
    let id = ids.get(key);
    if (id === undefined) {
      id = vertices.length;
      ids.set(key, id);
      vertices.push(p);
    }
    return id;
  };

  const edges: RawEdge[] = [];
  for (const way of highways) {
    const covered =
      COVERED_VALUES.has(way.tags['covered'] ?? '') || way.tags['tunnel'] === 'building_passage';
    const name = way.tags['name'] ? englishStreetName(way.tags['name']) : undefined;
    const highway = way.tags['highway'] ?? 'residential';
    const attr = `${highway}|${name ?? ''}|${covered}`;
    for (let i = 1; i < way.points.length; i++) {
      const p = way.points[i - 1]!;
      const q = way.points[i]!;
      const lengthM = distance(p, q);
      if (lengthM === 0 || Math.hypot(...p) > radiusM || Math.hypot(...q) > radiusM) continue;
      const a = vertexOf(p);
      const b = vertexOf(q);
      if (a !== b) edges.push({ a, b, lengthM, attr, highway, name, covered, points: [p, q] });
    }
  }
  return { vertices, edges };
}

function incidence(edges: readonly RawEdge[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  edges.forEach((e, index) => {
    for (const v of [e.a, e.b]) map.set(v, [...(map.get(v) ?? []), index]);
  });
  return map;
}

function largestComponent(edges: readonly RawEdge[]): RawEdge[] {
  const at = incidence(edges);
  const seen = new Set<number>();
  let best: number[] = [];
  edges.forEach((_, start) => {
    if (seen.has(start)) return;
    const stack = [start];
    const members: number[] = [];
    seen.add(start);
    while (stack.length > 0) {
      const index = stack.pop()!;
      members.push(index);
      for (const v of [edges[index]!.a, edges[index]!.b]) {
        for (const next of at.get(v) ?? []) {
          if (!seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        }
      }
    }
    if (members.length > best.length) best = members;
  });
  return best.map((i) => edges[i]!);
}

/** Repeatedly remove very short dead-end stubs (driveway fragments and the like). */
function pruneStubs(edges: RawEdge[], minStubM: number): RawEdge[] {
  let current = edges;
  for (let round = 0; round < 3; round++) {
    const at = incidence(current);
    const next = current.filter((e) => {
      const leaf = (at.get(e.a)?.length ?? 0) === 1 || (at.get(e.b)?.length ?? 0) === 1;
      return !(leaf && e.lengthM < minStubM);
    });
    if (next.length === current.length) break;
    current = next;
  }
  return current;
}

/** Collapse chains of degree-2 vertices into polylines between junctions. */
function chains(edges: readonly RawEdge[]): { points: XY[]; edge: RawEdge }[] {
  const at = incidence(edges);
  const isKeep = (v: number): boolean => {
    const incident = at.get(v) ?? [];
    return incident.length !== 2 || edges[incident[0]!]!.attr !== edges[incident[1]!]!.attr;
  };
  const used = new Set<number>();
  const result: { points: XY[]; edge: RawEdge }[] = [];
  const vertexXY = (e: RawEdge, v: number): XY => (v === e.a ? e.points[0] : e.points[1]);

  const walk = (startEdge: number, startVertex: number): void => {
    if (used.has(startEdge)) return;
    const first = edges[startEdge]!;
    const points: XY[] = [vertexXY(first, startVertex)];
    let current = startEdge;
    let vertex = startVertex;
    for (;;) {
      used.add(current);
      const e = edges[current]!;
      const next = e.a === vertex ? e.b : e.a;
      points.push(vertexXY(e, next));
      vertex = next;
      if (isKeep(vertex)) break;
      const following = (at.get(vertex) ?? []).find((i) => !used.has(i));
      if (following === undefined) break;
      current = following;
    }
    result.push({ points, edge: first });
  };

  edges.forEach((e, index) => {
    for (const v of [e.a, e.b]) if (isKeep(v)) walk(index, v);
  });
  // Pure loops with no junction: start anywhere.
  edges.forEach((e, index) => walk(index, e.a));
  return result;
}

export function buildNetwork(highways: readonly Highway[], options: NetworkOptions): Network {
  const { edges } = collectEdges(highways, options.radiusM);
  const clean = pruneStubs(largestComponent(edges), options.minStubM);
  const kept = largestComponent(clean);

  const nodes: NetNode[] = [];
  const nodeIds = new Map<string, string>();
  const nodeFor = (p: XY): string => {
    const key = keyOf(p);
    let id = nodeIds.get(key);
    if (!id) {
      id = `n-${nodes.length + 1}`;
      nodeIds.set(key, id);
      nodes.push({ id, xy: p });
    }
    return id;
  };

  const segments: NetSegment[] = [];
  for (const { points, edge } of chains(kept)) {
    const simple = simplify(points, options.simplifyToleranceM);
    for (let i = 1; i < simple.length; i++) {
      const pieces = splitEvenly(simple[i - 1]!, simple[i]!, options.maxSegmentM);
      for (let j = 1; j < pieces.length; j++) {
        const from = nodeFor(pieces[j - 1]!);
        const to = nodeFor(pieces[j]!);
        if (from === to) continue;
        segments.push({
          id: `seg-${segments.length + 1}`,
          from,
          to,
          lengthM: distance(pieces[j - 1]!, pieces[j]!),
          highway: edge.highway,
          name: edge.name,
          covered: edge.covered,
          widthM: WIDTH_BY_HIGHWAY[edge.highway] ?? 2,
        });
      }
    }
  }
  return { nodes, segments };
}
