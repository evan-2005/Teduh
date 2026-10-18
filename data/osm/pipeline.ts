/**
 * Turn raw OpenStreetMap elements into a complete, ready-to-load area dataset.
 *
 * Pure and environment-free (no file or network access), so the same code runs in the batch
 * tools under Node and in the browser when someone looks up a new place. Everything it produces
 * is estimated, not measured; the assumptions are stored in the dataset metadata and shown in
 * the app.
 */
import { buildGraph } from '../../src/lib/graph';
import { createEvaluator } from '../../src/lib/optimizer';
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
import { clusterHomes, compassName, planDestinations, residentialBuildings, type CountedStation } from './destinations';
import type { RailRidership } from './ridership';
import { createProjection, type Projection, type XY } from './geometry';
import { buildNetwork, DEFAULT_NETWORK_OPTIONS, type Network } from './network';
import { parseOsm, type ParsedOsm, type RawElement } from './parse';
import { BuildingIndex, MALAYSIA_UTC_OFFSET_H, segmentShade, SLOT_HOURS, sunPosition } from './shade';

export interface AreaInput {
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Clock offset from UTC used for the sun position. Defaults to Malaysia (UTC+8). */
  utcOffsetH?: number;
}

export interface BuildInput {
  area: AreaInput;
  elements: readonly RawElement[];
  unitCosts: UnitCosts;
  /** Field-surveyed tree locations as [lng, lat], merged with any mapped trees. */
  surveyedTrees?: readonly (readonly [number, number])[];
  /** Date the raw data was downloaded (YYYY-MM-DD). */
  fetchedAt: string;
  /** Real rail station exits (data/rail-ridership.json); without it every station gets a default weight. */
  ridership?: RailRidership;
}

export interface BuiltArea {
  neighbourhood: Neighbourhood;
  journeys: Journey[];
  interventions: Intervention[];
  context: AreaContext;
}

/** Thrown when an area has too little mapped data to analyse; the message is user-facing. */
export class AreaTooSparseError extends Error {}

const NETWORK_MARGIN_M = 100;
const DAY_OF_YEAR = 288; // 15 October
const MIN_BUILDING_AREA_M2 = 12;
const COORD_DECIMALS = 6;
const DEMO_BUDGET_STEP = 10_000;
const MAX_BUDGET_STEP = 50_000;
const BUDGET_SLIDER_STEP = 5_000;
const DEMO_BUDGET_FACTOR = 2.5;
const MIN_SEGMENTS = 40;
const MIN_HOME_BUILDINGS = 40;
const MIN_JOURNEYS = 4;
const MIN_CANDIDATES = 2;
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
  area: AreaInput,
): { nodes: PathNode[]; segments: PathSegment[]; info: Map<string, SegmentInfo> } {
  const xyOf = new Map(network.nodes.map((n) => [n.id, n.xy]));
  const casters = { buildings: new BuildingIndex(parsed.buildings), trees: parsed.trees };
  const offset = area.utcOffsetH ?? MALAYSIA_UTC_OFFSET_H;
  const suns = Object.fromEntries(
    SLOTS.map((t) => [t, sunPosition(area.lat, area.lng, DAY_OF_YEAR, SLOT_HOURS[t], offset)]),
  );

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

function budgetFor(interventions: readonly Intervention[]): DatasetMeta['budget'] {
  const shelters = interventions.filter((i) => i.type === 'shelter');
  const trees = interventions.filter((i) => i.type === 'tree');
  const treeAverage = trees.length ? trees.reduce((s, t) => s + t.installCost, 0) / trees.length : 0;
  const cheapestShelter = shelters.length ? Math.min(...shelters.map((s) => s.installCost)) : 0;
  const demo = Math.max(DEMO_BUDGET_STEP, ceilTo(cheapestShelter + 2 * treeAverage, DEMO_BUDGET_STEP));
  return { max: ceilTo(demo * DEMO_BUDGET_FACTOR, MAX_BUDGET_STEP), step: BUDGET_SLIDER_STEP, demo };
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

const thousands = (n: number): string => n.toLocaleString('en-US');

/** How the trips from each counted station were scaled, or why the stations use a default. */
function tripsNote(counted: readonly CountedStation[], ridership: RailRidership | undefined): string {
  if (counted.length === 0 || !ridership) {
    return 'Trips per day are rough estimates: bigger places (a rail station, a mall) draw more walks, and longer walks fewer. They are not counts.';
  }
  const stations = counted
    .map((s) => `the ${s.label} (${s.localName ?? s.code}) has ${thousands(s.exits)} exits on a typical weekday`)
    .join('; ');
  return (
    `Walks from rail stations are scaled to real ticket-gate counts: ${stations} (median weekday, ${ridership.from} to ${ridership.to}; Prasarana Rapid Rail data via data.gov.my, ${ridership.licence}). ` +
    'How those people split between the places nearby is still modelled: bigger places and shorter walks draw more, and the modelled walks never add up to more than half of the exits. Bus stop and other trips are rough estimates, not counts.'
  );
}

function assumptionsFor(radiusM: number, treeCount: number, trips: string): string[] {
  const treeNote =
    treeCount === 0
      ? ' OpenStreetMap has no mapped trees in this area, so tree canopy is not included and shade is understated.'
      : ` ${treeCount} mapped trees are included.`;
  return [
    `Paths are walkable ways from OpenStreetMap within ${radiusM} m of the centre, simplified into segments of at most ${DEFAULT_NETWORK_OPTIONS.maxSegmentM} m.`,
    `Shade is modelled, not surveyed: building shadows from mapped footprints (7 m high when the height is not mapped), the sun position on 15 October at this latitude, and covered walkways.${treeNote}`,
    'Walks start at public transport (rail stations and bus stops) and end at the places people walk to from it: malls, markets, supermarkets, schools, clinics, places of worship and parks. Home clusters are used only where too little transit is mapped.',
    trips,
    'Intervention locations are chosen where exposed paths carry the most trips. Covered walkways start at a bus stop, a station or the entrance of a place people walk to (or where its existing cover ends); street trees go along the footpath edge about 8 m apart. Costs come from the unit-cost bill of materials. Replace both with a real survey and contractor quotes.',
  ];
}

/** Build a full area dataset. Throws `AreaTooSparseError` when there is not enough mapped data. */
export function buildArea(input: BuildInput): BuiltArea {
  const { area, unitCosts } = input;
  const proj = createProjection(area.lat, area.lng);
  const parsed = parseOsm(input.elements, proj);
  parsed.trees.push(...(input.surveyedTrees ?? []).map(([lng, lat]) => proj.toXY(lat, lng)));
  const radiusM = area.radiusM - NETWORK_MARGIN_M;

  const network = buildNetwork(parsed.highways, { ...DEFAULT_NETWORK_OPTIONS, radiusM });
  if (network.segments.length < MIN_SEGMENTS) {
    throw new AreaTooSparseError(
      `Only ${network.segments.length} walkable paths are mapped here. Try a denser built-up area.`,
    );
  }

  // Homes are only a fallback origin (see planDestinations), so a handful of them is not enough.
  const homeBuildings = residentialBuildings(parsed.buildings);
  const homes = homeBuildings.length >= MIN_HOME_BUILDINGS ? clusterHomes(homeBuildings) : [];

  const { nodes, segments, info } = toPathData(network, proj, parsed, area);
  const graph = buildGraph(nodes, segments);
  const nodesXY = network.nodes.map((n, i) => ({ node: nodes[i]!, xy: n.xy }));
  const streetAtNode = new Map<string, string>();
  segments.forEach((s) => {
    const name = info.get(s.id)?.name;
    if (!name) return;
    if (!streetAtNode.has(s.from)) streetAtNode.set(s.from, name);
    if (!streetAtNode.has(s.to)) streetAtNode.set(s.to, name);
  });
  const { destinations, journeys, counted } = planDestinations({
    graph,
    nodes: nodesXY,
    homes,
    pois: parsed.pois,
    greens: parsed.greens,
    areaCentre: [0, 0],
    streetOf: (nodeId) => streetAtNode.get(nodeId),
    ridership: input.ridership,
  });
  if (journeys.length < MIN_JOURNEYS) {
    throw new AreaTooSparseError(
      'Too few bus stops, stations or homes are mapped here, within walking distance of schools, shops, clinics or parks. Try a denser built-up area.',
    );
  }

  const midpoints = segmentMidpoints(network);
  const sideOf = (ids: readonly string[]): string => {
    const points = ids.map((id) => midpoints.get(id)!);
    return compassName(
      points.reduce((sum, p) => sum + p[0], 0) / points.length,
      points.reduce((sum, p) => sum + p[1], 0) / points.length,
    );
  };
  const interventions = generateCandidates({ segments, graph, journeys, destinations, info, unitCosts, sideOf });
  if (interventions.length < MIN_CANDIDATES) {
    throw new AreaTooSparseError('No exposed paths with enough trips were found to improve here.');
  }

  const budget = budgetFor(interventions);
  const meta: DatasetMeta = {
    name: area.name,
    center: [area.lat, area.lng],
    radiusM,
    source: 'openstreetmap',
    attribution: 'Map data © OpenStreetMap contributors (ODbL)',
    generatedAt: input.fetchedAt.slice(0, 10),
    assumptions: assumptionsFor(radiusM, parsed.trees.length, tripsNote(counted, input.ridership)),
    budget,
    demoJourneyId: pickDemoJourney({ graph, segments, destinations, journeys, interventions, budget: budget.demo }),
  };

  return {
    neighbourhood: { nodes, segments, destinations, meta },
    journeys,
    interventions,
    context: buildContext(parsed, proj, radiusM),
  };
}
