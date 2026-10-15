/**
 * Download raw OpenStreetMap data for an area into data/osm/raw.json.
 *
 *   npx tsx data/osm/fetch.ts [lat lng radiusM name]
 *
 * Defaults to the demo area (SS 4, Petaling Jaya).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fetchOverpass, type Area } from './overpass';

export const DEFAULT_AREA: Area = {
  name: 'SS 4, Petaling Jaya',
  lat: 3.1075,
  lng: 101.607,
  radiusM: 550,
};
export const RAW_PATH = 'data/osm/raw.json';

if (process.argv[1]?.endsWith('fetch.ts')) {
  const [lat, lng, radiusM, ...name] = process.argv.slice(2);
  const area: Area =
    lat && lng
      ? { lat: Number(lat), lng: Number(lng), radiusM: Number(radiusM ?? 550), name: name.join(' ') || 'Custom area' }
      : DEFAULT_AREA;
  const log = (msg: string) => process.stderr.write(`${msg}\n`);
  log(`Fetching ${area.name} (${area.lat}, ${area.lng}, ${area.radiusM} m)...`);
  const raw = await fetchOverpass(area, log);
  mkdirSync(dirname(RAW_PATH), { recursive: true });
  writeFileSync(RAW_PATH, JSON.stringify({ area, fetchedAt: new Date().toISOString(), raw }));
  log(`Saved ${RAW_PATH}`);
}
