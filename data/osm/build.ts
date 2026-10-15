/**
 * Build the real-area dataset from raw OpenStreetMap data.
 *
 *   npx tsx data/osm/fetch.ts      (downloads data/osm/raw.json; needs the internet once)
 *   npx tsx data/osm/build.ts      (writes data/osm/{neighbourhood,journeys,interventions,context}.json)
 *
 * Everything this writes is estimated, not measured. The assumptions are stored in the dataset
 * metadata and shown in the app.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createEvaluator } from '../../src/lib/optimizer';
import { buildGraph } from '../../src/lib/graph';
import type {
  AreaContext,
  DatasetMeta,
  Destination,
  Intervention,
  Journey,
  Neighbourhood,
  PathNode,
  PathSegment,
  TimeSlot,
  UnitCosts,
} from '../../src/types';
import { generateCandidates, HIGHWAY_LABELS, type SegmentInfo } from './candidates';
import { clusterHomes, compassName, planDestinations, residentialBuildings } from './destinations';
import { createProjection, type Projection, type XY } from './geometry';
import { buildNetwork, DEFAULT_NETWORK_OPTIONS, type Network } from './network';
import { parseOsm, type ParsedOsm, type RawElement } from './parse';
import { BuildingIndex, segmentShade, SLOT_HOURS, sunPosition } from './shade';

const OUT_DIR = 'data/osm';
const SURVEYED_TREES_PATH = 'data/osm/surveyed-trees.geojson';
const NETWORK_MARGIN_M = 100;
const DAY_OF_YEAR = 288; // 15 October
const MIN_BUILDING_AREA_M2 = 12;
const COORD_DECIMALS = 6;
const DEMO_BUDGET_STEP = 10_000;
const MAX_BUDGET_STEP = 50_000;
const BUDGET_SLIDER_STEP = 5_000;
const DEMO_BUDGET_FACTOR = 2.5;
const SLOTS = Object.keys(SLOT_HOURS) as TimeSlot[];

const round = (n: number): number => Number(n.toFixed(COORD_DECIMALS));
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const ceilTo = (value: number, step: number): number => Math.ceil(value / step) * step;

function ringArea(ring: readonly XY[]): number {
  let sum = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]!;
    sum += p[0] * q[1] - q[0] * p[1];
  });
  return Math.abs(sum) / 2;
}

function toPathData(
  network: Network,
  proj: Projection,
  parsed: ParsedOsm,
  lat: number,
  lng: number,
): { nodes: PathNode[]; segments: PathSegment[]; info: Map<string, SegmentInfo> } {
  const xyOf = new Map(network.nodes.map((n) => [n.id, n.xy]));
  const casters = { buildings: new BuildingIndex(parsed.buildings), trees: parsed.trees };
  const suns = Object.fromEntries(SLOTS.map((t) => [t, sunPosition(lat, lng, DAY_OF_YEAR, SLOT_HOURS[t])]));

  const nodes: PathNode[] = network.nodes.map((n) => {
    const [la, lo] = proj.toLatLng(n.xy[0], n.xy[1]);
    return { id: n.id, lat: round(la), lng: round(lo) };
  });
  const info = new Map<string, SegmentInfo>();
  const segments: PathSegment[] = network.segments.map((s) => {
    const a = xyOf.get(s.from)!;
    const b = xyOf.get(s.to)!;
    const shade = Object.fromEntries(
      SLOTS.map((t) => [t, segmentShade(a, b, s.covered, suns[t]!, casters)]),
    ) as PathSegment['shade'];
    info.set(s.id, { name: s.name, highway: s.highway });
    const kind = capitalise(HIGHWAY_LABELS[s.highway] ?? 'path');
    return {
      id: s.id,
      from: s.from,
      to: s.to,
      widthM: s.widthM,
      shade,
      shadeSource: 'estimated',
      accessible: true,
      notes: `${kind}${s.name ? `: ${s.name}` : ''}${s.covered ? ' (covered)' : ''}`,
    };
  });
  return { nodes, segments, info };
}

function segmentMidpoints(network: Network): Map<string, XY> {
  const xyOf = new Map(network.nodes.map((n) => [n.id, n.xy]));
  return new Map(
    network.segments.map((s) => {
      const a = xyOf.get(s.from)!;
      const b = xyOf.get(s.to)!;
      return [s.id, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as XY];
    }),
  );
}

function buildContext(parsed: ParsedOsm, proj: Projection, radiusM: number): AreaContext {
  const pair = (p: XY): [number, number] => {
    const [la, lo] = proj.toLatLng(p[0], p[1]);
    return [round(la), round(lo)];
  };
  const within = (p: XY): boolean => Math.hypot(p[0], p[1]) <= radiusM;
  const seen = new Set<string>();
  return {
    buildings: parsed.buildings
      .filter((b) => ringArea(b.ring) >= MIN_BUILDING_AREA_M2 && within(b.ring[0]!))
      .map((b) => b.ring.map(pair)),
    greens: parsed.greens.filter((g) => within(g.ring[0]!)).map((g) => ({ kind: g.kind, ring: g.ring.map(pair) })),
    landmarks: parsed.pois
      .filter((p) => within(p.xy) && !seen.has(p.id) && seen.add(p.id))
      .map((p) => {
        const [lat, lng] = pair(p.xy);
        return {
          id: p.id,
          kind: p.landmark,
          name: p.label,
          ...(p.tags['name'] ? { localName: p.tags['name'] } : {}),
          lat,
          lng,
        };
      }),
    trees: parsed.trees.filter(within).map(pair),
  };
}

function budgetFor(interventions: readonly Intervention[]): DatasetMeta['budget'] {
  const shelters = interventions.filter((i) => i.type === 'shelter').sort((a, b) => b.installCost - a.installCost);
  const trees = interventions.filter((i) => i.type === 'tree');
  const treeAverage = trees.length ? trees.reduce((s, t) => s + t.installCost, 0) / trees.length : 0;
  const anchor = (shelters.length ? Math.min(...shelters.map((s) => s.installCost)) : 0) + 2 * treeAverage;
  const demo = Math.max(DEMO_BUDGET_STEP, ceilTo(anchor, DEMO_BUDGET_STEP));
  return { max: ceilTo(demo * DEMO_BUDGET_FACTOR, MAX_BUDGET_STEP), step: BUDGET_SLIDER_STEP, demo };
}

/** Optional field-survey tree locations (GeoJSON points) that fill gaps in OpenStreetMap. */
function surveyedTrees(proj: Projection): XY[] {
  if (!existsSync(SURVEYED_TREES_PATH)) return [];
  const collection = JSON.parse(readFileSync(SURVEYED_TREES_PATH, 'utf8')) as {
    features: { geometry: { type: string; coordinates: [number, number] } }[];
  };
  return collection.features
    .filter((f) => f.geometry.type === 'Point')
    .map((f) => proj.toXY(f.geometry.coordinates[1], f.geometry.coordinates[0]));
}

const write = (name: string, data: unknown, indent?: number): void =>
  writeFileSync(`${OUT_DIR}/${name}.json`, JSON.stringify(data, null, indent) + '\n');

export function build(): void {
  const file = JSON.parse(readFileSync(`${OUT_DIR}/raw.json`, 'utf8')) as {
    area: { name: string; lat: number; lng: number; radiusM: number };
    fetchedAt: string;
    raw: { elements: RawElement[] };
  };
  const { area } = file;
  const proj = createProjection(area.lat, area.lng);
  const parsed = parseOsm(file.raw.elements, proj);
  parsed.trees.push(...surveyedTrees(proj));
  const network = buildNetwork(parsed.highways, {
    ...DEFAULT_NETWORK_OPTIONS,
    radiusM: area.radiusM - NETWORK_MARGIN_M,
  });

  const { nodes, segments, info } = toPathData(network, proj, parsed, area.lat, area.lng);
  const graph = buildGraph(nodes, segments);
  const nodesXY = network.nodes.map((n, i) => ({ node: nodes[i]!, xy: n.xy }));
  const homes = clusterHomes(residentialBuildings(parsed.buildings));
  const { destinations, journeys } = planDestinations({
    graph, nodes: nodesXY, homes, pois: parsed.pois, greens: parsed.greens, areaCentre: [0, 0],
  });

  const unitCosts = JSON.parse(readFileSync('data/unit-costs.json', 'utf8')) as UnitCosts;
  const midpoints = segmentMidpoints(network);
  const sideOf = (ids: readonly string[]): string => {
    const points = ids.map((id) => midpoints.get(id)!);
    const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const y = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    return compassName(x, y);
  };
  const interventions = generateCandidates({ segments, graph, journeys, destinations, info, unitCosts, sideOf });
  const budget = budgetFor(interventions);
  const demoJourneyId = pickDemoJourney({ graph, segments, destinations, journeys, interventions, budget: budget.demo });

  const treeNote = parsed.trees.length === 0
    ? ' OpenStreetMap has no mapped trees in this area, so tree canopy is not included and shade is understated.'
    : '';
  const meta: DatasetMeta = {
    name: area.name,
    center: [area.lat, area.lng],
    radiusM: area.radiusM - NETWORK_MARGIN_M,
    source: 'openstreetmap',
    attribution: 'Map data © OpenStreetMap contributors (ODbL)',
    generatedAt: file.fetchedAt.slice(0, 10),
    assumptions: [
      `Paths are walkable ways from OpenStreetMap within ${area.radiusM - NETWORK_MARGIN_M} m of the centre, simplified into segments of at most ${DEFAULT_NETWORK_OPTIONS.maxSegmentM} m.`,
      `Shade is modelled, not surveyed: building shadows from mapped footprints (7 m high when the height is not mapped), the sun position on 15 October at this latitude, and covered walkways.${treeNote}`,
      'Trips per day are rough estimates from the number of buildings near each home cluster.',
      'Intervention locations are chosen where exposed paths carry the most trips; costs come from the unit-cost bill of materials. Replace both with a real survey and contractor quotes.',
    ],
    budget,
    demoJourneyId,
  };

  const neighbourhood: Neighbourhood = { nodes, segments, destinations, meta };
  write('neighbourhood', neighbourhood, 2);
  write('journeys', journeys, 2);
  write('interventions', interventions, 2);
  write('context', buildContext(parsed, proj, area.radiusM - NETWORK_MARGIN_M));

  const log = (msg: string): void => void process.stderr.write(`${msg}\n`);
  log(`Segments: ${segments.length}, nodes: ${nodes.length}, destinations: ${destinations.length}, journeys: ${journeys.length}`);
  log(`Candidates: ${interventions.map((i) => `${i.id} RM ${i.installCost}`).join(', ')}`);
  log(`Budget: ${JSON.stringify(budget)}  Demo journey: ${demoJourneyId}`);
}

function pickDemoJourney(args: {
  graph: ReturnType<typeof buildGraph>;
  segments: PathSegment[];
  destinations: Destination[];
  journeys: Journey[];
  interventions: Intervention[];
  budget: number;
}): string {
  const evaluator = createEvaluator({
    graph: args.graph,
    segments: args.segments,
    destinations: args.destinations,
    journeys: args.journeys,
    candidates: args.interventions,
    time: '14:00',
    canopy: 'now',
    canopyYear: 0,
    detourLimit: 0.25,
    priorityWeights: {},
    overrides: [],
  });
  const best = evaluator.recommend(args.budget)[0];
  const trips = new Map(args.journeys.map((j) => [j.id, j.dailyTrips]));
  const ranked = (best?.journeys ?? [])
    .map((c) => ({ id: c.journeyId, gain: (trips.get(c.journeyId) ?? 0) * (c.before.sunMin - c.after.sunMin) }))
    .sort((a, b) => b.gain - a.gain);
  return ranked[0]?.id ?? args.journeys[0]?.id ?? '';
}

if (process.argv[1]?.endsWith('build.ts')) build();
