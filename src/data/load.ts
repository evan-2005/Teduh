import { z } from 'zod';
import unitCostsRaw from '../../data/unit-costs.json';
import { MAX_CANDIDATES } from '../config';
import { loadCustomArea } from './customAreas';
import type {
  Destination,
  Intervention,
  Journey,
  Neighbourhood,
  UnitCosts,
} from '../types';

const fraction = z.number().min(0).max(1);
const dataSource = z.enum(['surveyed', 'estimated', 'ai-confirmed', 'missing']);

const shadeByTime = z.object({
  '09:00': fraction,
  '12:00': fraction,
  '14:00': fraction,
  '17:00': fraction,
});

export const pathNodeSchema = z.object({
  id: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().optional(),
});

export const pathSegmentSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  lengthM: z.number().positive().optional(),
  widthM: z.number().positive(),
  shade: shadeByTime,
  shadeSource: dataSource,
  accessible: z.boolean(),
  notes: z.string().optional(),
});

export const destinationSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['home', 'rail-station', 'bus-stop', 'mall', 'shops', 'school', 'clinic', 'worship', 'park']),
  localName: z.string().optional(),
});

export const datasetMetaSchema = z.object({
  name: z.string().min(1),
  center: z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]),
  radiusM: z.number().positive().optional(),
  source: z.enum(['synthetic', 'openstreetmap', 'surveyed']),
  attribution: z.string().optional(),
  generatedAt: z.string().optional(),
  assumptions: z.array(z.string()).optional(),
  budget: z.object({
    max: z.number().positive(),
    step: z.number().positive(),
    demo: z.number().nonnegative(),
  }),
  demoJourneyId: z.string().min(1),
});

export const neighbourhoodSchema = z.object({
  nodes: z.array(pathNodeSchema).min(2),
  segments: z.array(pathSegmentSchema).min(1),
  destinations: z.array(destinationSchema).min(2),
  meta: datasetMetaSchema.optional(),
});

export const journeySchema = z.object({
  id: z.string().min(1),
  originId: z.string().min(1),
  destinationId: z.string().min(1),
  dailyTrips: z.number().nonnegative(),
  tripsSource: dataSource,
});

export const interventionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['tree', 'shelter']),
  name: z.string().min(1),
  segmentIds: z.array(z.string().min(1)).min(1),
  installCost: z.number().nonnegative(),
  annualMaintenance: z.number().nonnegative(),
  shadeNow: fraction,
  shadeFuture: fraction,
  yearsToMature: z.number().nonnegative(),
  feasibility: z.enum(['approved', 'likely', 'needs-check']),
  costSource: dataSource,
});

export const unitCostsSchema = z.object({
  currency: z.literal('MYR'),
  costSource: dataSource,
  contingencyRate: fraction,
  items: z.record(
    z.string(),
    z.object({
      label: z.string().min(1),
      unit: z.string().min(1),
      unitCost: z.number().nonnegative(),
    }),
  ),
  speciesSuggestions: z.array(
    z.object({
      name: z.string().min(1),
      matureCanopyM: z.number().positive(),
      yearsToMature: z.number().positive(),
      verify: z.literal(true),
    }),
  ),
});

export interface Dataset {
  readonly neighbourhood: Neighbourhood;
  readonly journeys: readonly Journey[];
  readonly interventions: readonly Intervention[];
  readonly unitCosts: UnitCosts;
}

const findDuplicates = (ids: readonly string[]): string[] =>
  ids.filter((id, i) => ids.indexOf(id) !== i);

/** Cross-file reference checks that zod's per-file schemas cannot express. */
export function referenceErrors(data: Dataset): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(data.neighbourhood.nodes.map((n) => n.id));
  const segmentIds = new Set(data.neighbourhood.segments.map((s) => s.id));
  const destinations = data.neighbourhood.destinations;
  const destById = new Map<string, Destination>(destinations.map((d) => [d.id, d]));

  const duplicates = [
    ...findDuplicates(data.neighbourhood.nodes.map((n) => n.id)),
    ...findDuplicates(data.neighbourhood.segments.map((s) => s.id)),
    ...findDuplicates(data.interventions.map((i) => i.id)),
  ];
  duplicates.forEach((id) => errors.push(`duplicate id: ${id}`));

  data.neighbourhood.segments.forEach((s) => {
    if (!nodeIds.has(s.from)) errors.push(`segment ${s.id}: unknown node ${s.from}`);
    if (!nodeIds.has(s.to)) errors.push(`segment ${s.id}: unknown node ${s.to}`);
  });
  destinations.forEach((d) => {
    if (!nodeIds.has(d.nodeId)) errors.push(`destination ${d.id}: unknown node ${d.nodeId}`);
  });
  data.journeys.forEach((j) => {
    if (!destById.has(j.originId)) errors.push(`journey ${j.id}: unknown origin ${j.originId}`);
    if (j.originId === j.destinationId) {
      errors.push(`journey ${j.id}: starts and ends at the same place`);
    }
    if (!destById.has(j.destinationId)) {
      errors.push(`journey ${j.id}: unknown destination ${j.destinationId}`);
    }
  });
  data.interventions.forEach((i) => {
    i.segmentIds.forEach((id) => {
      if (!segmentIds.has(id)) errors.push(`intervention ${i.id}: unknown segment ${id}`);
    });
  });
  if (data.interventions.length > MAX_CANDIDATES) {
    errors.push(`too many candidates: ${data.interventions.length} > ${MAX_CANDIDATES}`);
  }
  return errors;
}

/** Parse raw JSON into a validated dataset. Throws a readable error on bad data. */
export function parseDataset(raw: {
  neighbourhood: unknown;
  journeys: unknown;
  interventions: unknown;
  unitCosts: unknown;
}): Dataset {
  const dataset: Dataset = {
    neighbourhood: neighbourhoodSchema.parse(raw.neighbourhood),
    journeys: z.array(journeySchema).parse(raw.journeys),
    interventions: z.array(interventionSchema).parse(raw.interventions),
    unitCosts: unitCostsSchema.parse(raw.unitCosts),
  };
  const errors = referenceErrors(dataset);
  if (errors.length > 0) {
    throw new Error(`Invalid dataset:\n${errors.join('\n')}`);
  }
  return dataset;
}

/** 'seed', an area slug such as 'ss4-petaling-jaya', or 'custom:<slug>' for a place looked up in the browser. */
export type AreaId = string;

export const CUSTOM_PREFIX = 'custom:';

// Every bundled area is its own lazy chunk, so only the active one is downloaded.
const bundled = import.meta.glob<unknown>(
  [
    '../../data/areas/*/neighbourhood.json',
    '../../data/areas/*/journeys.json',
    '../../data/areas/*/interventions.json',
    '../../data/seed/*.json',
  ],
  { import: 'default' },
);

async function bundledFile(id: AreaId, file: string): Promise<unknown> {
  const folder = id === 'seed' ? 'seed' : `areas/${id}`;
  const load = bundled[`../../data/${folder}/${file}.json`];
  if (!load) throw new Error(`Missing data file data/${folder}/${file}.json`);
  return load();
}

export async function loadDataset(id: AreaId): Promise<Dataset> {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const saved = loadCustomArea(id.slice(CUSTOM_PREFIX.length));
    if (!saved) throw new Error(`Saved area ${id} was not found in this browser`);
    return parseDataset({
      neighbourhood: saved.neighbourhood,
      journeys: saved.journeys,
      interventions: saved.interventions,
      unitCosts: unitCostsRaw,
    });
  }
  const [neighbourhood, journeys, interventions] = await Promise.all([
    bundledFile(id, 'neighbourhood'),
    bundledFile(id, 'journeys'),
    bundledFile(id, 'interventions'),
  ]);
  return parseDataset({ neighbourhood, journeys, interventions, unitCosts: unitCostsRaw });
}
