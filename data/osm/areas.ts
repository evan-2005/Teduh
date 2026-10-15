/**
 * Batch tool: download (if needed) and build every area listed in data/areas/areas.json.
 *
 *   npm run data:areas                      all areas; downloads any raw data that is missing
 *   npm run data:areas -- ss4-petaling-jaya one or more areas by slug
 *   npm run data:areas -- --build-only      never touch the network (uses saved raw.json files)
 *   npm run data:areas -- --refresh         download again even if raw.json exists
 *
 * Writes data/areas/<slug>/{neighbourhood,journeys,interventions,context}.json and rebuilds
 * data/areas/index.json (only areas that built successfully). raw.json files are git-ignored.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { UnitCosts } from '../../src/types';
import { fetchOverpass, type Area } from './overpass';
import { AreaTooSparseError, buildArea } from './pipeline';
import type { RawElement } from './parse';

interface AreaEntry extends Area {
  slug: string;
  group: string;
}

const ROOT = 'data/areas';
const POLITE_DELAY_MS = 8000;

const log = (message: string): void => void process.stderr.write(`${message}\n`);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const write = (path: string, data: unknown, indent?: number): void =>
  writeFileSync(path, JSON.stringify(data, null, indent) + '\n');

async function rawFor(entry: AreaEntry, allowFetch: boolean, refresh: boolean): Promise<{ elements: RawElement[]; fetchedAt: string }> {
  const path = `${ROOT}/${entry.slug}/raw.json`;
  if (existsSync(path) && !refresh) {
    const saved = readJson<{ fetchedAt: string; raw: { elements: RawElement[] } }>(path);
    return { elements: saved.raw.elements, fetchedAt: saved.fetchedAt };
  }
  if (!allowFetch) throw new Error('no raw.json and --build-only was given');
  log(`  downloading ${entry.name} ...`);
  const raw = (await fetchOverpass(entry, (m) => log(`    ${m}`))) as { elements: RawElement[] };
  const fetchedAt = new Date().toISOString();
  write(path, { area: entry, fetchedAt, raw });
  await sleep(POLITE_DELAY_MS);
  return { elements: raw.elements, fetchedAt };
}

async function buildOne(entry: AreaEntry, unitCosts: UnitCosts, allowFetch: boolean, refresh: boolean): Promise<boolean> {
  const dir = `${ROOT}/${entry.slug}`;
  mkdirSync(dir, { recursive: true });
  try {
    const { elements, fetchedAt } = await rawFor(entry, allowFetch, refresh);
    const treesPath = `${dir}/surveyed-trees.geojson`;
    const surveyedTrees = existsSync(treesPath)
      ? readJson<{ features: { geometry: { type: string; coordinates: [number, number] } }[] }>(treesPath)
          .features.filter((f) => f.geometry.type === 'Point')
          .map((f) => f.geometry.coordinates)
      : [];
    const built = buildArea({ area: entry, elements, unitCosts, surveyedTrees, fetchedAt });
    write(`${dir}/neighbourhood.json`, built.neighbourhood, 2);
    write(`${dir}/journeys.json`, built.journeys, 2);
    write(`${dir}/interventions.json`, built.interventions, 2);
    write(`${dir}/context.json`, built.context);
    const { segments, destinations } = built.neighbourhood;
    log(`  OK   ${entry.slug}: ${segments.length} segments, ${destinations.length} destinations, ${built.journeys.length} journeys, ${built.interventions.length} candidates`);
    return true;
  } catch (error) {
    const reason = error instanceof AreaTooSparseError ? `too sparse: ${error.message}` : (error as Error).message;
    log(`  SKIP ${entry.slug}: ${reason}`);
    return false;
  }
}

const args = process.argv.slice(2);
const slugs = args.filter((a) => !a.startsWith('--'));
const buildOnly = args.includes('--build-only');
const refresh = args.includes('--refresh');

const all = readJson<AreaEntry[]>(`${ROOT}/areas.json`);
const wanted = slugs.length > 0 ? all.filter((a) => slugs.includes(a.slug)) : all;
const unitCosts = readJson<UnitCosts>('data/unit-costs.json');

const built = new Set<string>();
for (const entry of wanted) {
  log(`${entry.name}`);
  if (await buildOne(entry, unitCosts, !buildOnly, refresh)) built.add(entry.slug);
}

// The index lists every area that has built files on disk, so partial runs never drop areas.
const index = all
  .filter((a) => built.has(a.slug) || existsSync(`${ROOT}/${a.slug}/neighbourhood.json`))
  .map((a) => ({ slug: a.slug, name: a.name, group: a.group, center: [a.lat, a.lng] }));
write(`${ROOT}/index.json`, index, 2);
log(`Index: ${index.length} areas`);
