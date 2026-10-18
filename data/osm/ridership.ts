/**
 * Real rail ridership from Prasarana's ticket gates (data.gov.my, "ridership_od_rapidrail_daily",
 * CC BY 4.0). Rows from origin "A0: All Stations" give every station's total exits per day: the
 * people who leave that station, some of whom walk to the places the app models.
 *
 * Pure functions only; `fetch-ridership.ts` downloads the data and writes data/rail-ridership.json.
 */
import type { Tags } from './parse';

export interface StationRidership {
  name: string;
  /** Median exits on a weekday over the sampled weeks. */
  weekdayExits: number;
}

export interface RailRidership {
  source: string;
  url: string;
  licence: string;
  /** First and last dates sampled (YYYY-MM-DD). */
  from: string;
  to: string;
  /** Station code (e.g. "KJ29") -> its exits. */
  stations: Record<string, StationRidership>;
}

export const ALL_STATIONS = 'A0: All Stations';
const STATION_CODE = /\b([A-Z]{2}\d{2})\b/;
const DAY_MS = 86_400_000;
const SATURDAY = 6;
const SUNDAY = 0;

/** "KJ29: SS 15" -> { code: "KJ29", name: "SS 15" }. */
export function splitStation(label: string): { code: string; name: string } | null {
  const match = /^([A-Z]{2}\d{2}):\s*(.+)$/.exec(label.trim());
  return match ? { code: match[1]!, name: match[2]! } : null;
}

/** The station code in an OpenStreetMap station's tags ("ref", or a name like "KJ29 SS15"). */
export function stationCode(tags: Tags): string | null {
  for (const key of ['ref', 'railway:ref', 'name']) {
    const code = STATION_CODE.exec(tags[key] ?? '')?.[1];
    if (code) return code;
  }
  return null;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
};

/**
 * Median weekday exits per station over the last `weeks` weeks of "A0: All Stations" rows
 * (CSV columns: origin, destination, date, ridership). The median shrugs off public holidays.
 */
export function weekdayExits(rows: readonly string[], weeks: number): Omit<RailRidership, 'source' | 'url' | 'licence'> {
  const parsed = rows
    .map((row) => row.split(','))
    .filter((cells) => cells[0] === ALL_STATIONS && cells.length >= 4)
    .map(([, destination, date, ridership]) => ({ destination: destination!, day: date!.slice(0, 10), n: Number(ridership) }));
  const to = parsed.reduce((latest, r) => (r.day > latest ? r.day : latest), '');
  const from = new Date(Date.parse(to) - (weeks * 7 - 1) * DAY_MS).toISOString().slice(0, 10);
  const byStation = new Map<string, number[]>();
  for (const r of parsed) {
    const weekday = new Date(`${r.day}T00:00:00Z`).getUTCDay();
    if (r.day < from || weekday === SATURDAY || weekday === SUNDAY || !Number.isFinite(r.n)) continue;
    byStation.set(r.destination, [...(byStation.get(r.destination) ?? []), r.n]);
  }
  const stations: Record<string, StationRidership> = {};
  for (const [label, values] of byStation) {
    const station = splitStation(label);
    if (station) stations[station.code] = { name: station.name, weekdayExits: median(values) };
  }
  return { from, to, stations };
}

/** A station's real weekday exits, if the ridership data covers it. */
export function exitsFor(tags: Tags, ridership: RailRidership | undefined): { code: string; exits: number } | null {
  const code = stationCode(tags);
  const station = code ? ridership?.stations[code] : undefined;
  return code && station ? { code, exits: station.weekdayExits } : null;
}
