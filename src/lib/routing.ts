import { LAMBDA_SWEEP } from '../config';
import type { Edge, Graph } from './graph';
import type { ShadeLookup } from './shade';

export interface Route {
  /** Segment ids in walking order. */
  segmentIds: string[];
  lengthM: number;
}

type WeightFn = (edge: Edge) => number;

const LENGTH_TOLERANCE = 1e-9;

interface HeapItem { node: string; cost: number }

/** Minimal binary min-heap keyed on `cost`. */
class MinHeap {
  private readonly items: HeapItem[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: HeapItem): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent]!.cost <= this.items[i]!.cost) break;
      [this.items[parent], this.items[i]] = [this.items[i]!, this.items[parent]!];
      i = parent;
    }
  }

  pop(): HeapItem | undefined {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.siftDown();
    }
    return top;
  }

  private siftDown(): void {
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < this.items.length && this.items[left]!.cost < this.items[smallest]!.cost) {
        smallest = left;
      }
      if (right < this.items.length && this.items[right]!.cost < this.items[smallest]!.cost) {
        smallest = right;
      }
      if (smallest === i) return;
      [this.items[smallest], this.items[i]] = [this.items[i]!, this.items[smallest]!];
      i = smallest;
    }
  }
}

/** Dijkstra over `graph` with a custom edge weight. Returns null when unreachable. */
export function dijkstra(
  graph: Graph,
  from: string,
  to: string,
  weight: WeightFn,
): Route | null {
  const best = new Map<string, number>([[from, 0]]);
  const via = new Map<string, { prev: string; edge: Edge }>();
  const heap = new MinHeap();
  heap.push({ node: from, cost: 0 });

  while (heap.size > 0) {
    const { node, cost } = heap.pop()!;
    if (node === to) break;
    if (cost > (best.get(node) ?? Infinity)) continue;
    for (const edge of graph.adjacency.get(node) ?? []) {
      const next = cost + weight(edge);
      if (next < (best.get(edge.to) ?? Infinity)) {
        best.set(edge.to, next);
        via.set(edge.to, { prev: node, edge });
        heap.push({ node: edge.to, cost: next });
      }
    }
  }
  return best.has(to) ? reconstruct(via, from, to) : null;
}

function reconstruct(
  via: ReadonlyMap<string, { prev: string; edge: Edge }>,
  from: string,
  to: string,
): Route {
  const segmentIds: string[] = [];
  let lengthM = 0;
  for (let node = to; node !== from; ) {
    const step = via.get(node)!;
    segmentIds.unshift(step.edge.segmentId);
    lengthM += step.edge.lengthM;
    node = step.prev;
  }
  return { segmentIds, lengthM };
}

export function shortestRoute(graph: Graph, from: string, to: string): Route | null {
  return dijkstra(graph, from, to, (edge) => edge.lengthM);
}

/**
 * Least direct-sun route within a detour limit. For each lambda (strongest first) minimise
 * `length + lambda * length * (1 - shade)` and return the first route no longer than
 * `shortest * (1 + detourLimit)`. Lambda 0 is the shortest route, so this always terminates.
 */
export function leastSunRoute(
  graph: Graph,
  from: string,
  to: string,
  shade: ShadeLookup,
  detourLimit: number,
): Route | null {
  const shortest = shortestRoute(graph, from, to);
  if (!shortest) return null;
  const maxLengthM = shortest.lengthM * (1 + detourLimit) + LENGTH_TOLERANCE;

  for (const lambda of LAMBDA_SWEEP) {
    const route = dijkstra(graph, from, to, (edge) => {
      const sun = 1 - (shade.get(edge.segmentId) ?? 0);
      return edge.lengthM + lambda * edge.lengthM * sun;
    });
    if (route && route.lengthM <= maxLengthM) return route;
  }
  return shortest;
}
