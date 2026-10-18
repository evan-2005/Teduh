/**
 * Download Rapid Rail station exits from data.gov.my and save them to data/rail-ridership.json.
 *
 *   npm run data:ridership            the last 8 weeks of weekdays
 *
 * The yearly file is about 300 MB, but it is sorted by origin and the "A0: All Stations" rows we
 * need come first, so only the first few MB are downloaded (HTTP range requests).
 * Then run `npm run data:areas -- --build-only` to apply the new counts to the areas.
 */
import { writeFileSync } from 'node:fs';
import { ALL_STATIONS, weekdayExits, type RailRidership } from './ridership';

const YEAR = new Date().getUTCFullYear();
const URL_ = `https://storage.data.gov.my/transportation/rail/rapidrail_${YEAR}_daily.csv`;
const OUT = 'data/rail-ridership.json';
const CHUNK_BYTES = 1_000_000;
const MAX_BYTES = 20_000_000;
const WEEKS = 8;

const log = (message: string): void => void process.stderr.write(`${message}\n`);

async function fetchRange(start: number): Promise<string> {
  const response = await fetch(URL_, { headers: { Range: `bytes=${start}-${start + CHUNK_BYTES - 1}` } });
  if (!response.ok) throw new Error(`data.gov.my answered ${response.status} for ${URL_}`);
  return response.text();
}

/** Read chunks until the rows move past origin "A0: All Stations". */
async function allStationsRows(): Promise<string[]> {
  let text = '';
  for (let start = 0; start < MAX_BYTES; start += CHUNK_BYTES) {
    text += await fetchRange(start);
    const lines = text.split('\n');
    const complete = lines.slice(1, -1);
    if (complete.some((line) => line && !line.startsWith(ALL_STATIONS))) {
      return complete.filter((line) => line.startsWith(ALL_STATIONS));
    }
  }
  throw new Error(`No end to the "${ALL_STATIONS}" rows in the first ${MAX_BYTES} bytes`);
}

const rows = await allStationsRows();
const summary = weekdayExits(rows, WEEKS);
const ridership: RailRidership = {
  source: 'Prasarana Rapid Rail origin-destination ridership (ticket gates), via data.gov.my',
  url: 'https://data.gov.my/data-catalogue/ridership_od_rapidrail_daily',
  licence: 'CC BY 4.0',
  ...summary,
};
writeFileSync(OUT, `${JSON.stringify(ridership, null, 2)}\n`);
log(`Saved weekday exits for ${Object.keys(ridership.stations).length} stations, ${ridership.from} to ${ridership.to}, to ${OUT}`);
