import { describe, expect, test } from 'vitest';
import ridershipRaw from '../../data/rail-ridership.json';
import { exitsFor, splitStation, stationCode, weekdayExits, type RailRidership } from '../../data/osm/ridership';
import { capToExits, EXITS_PER_WEIGHT, MAX_WALKING_SHARE, weightFromExits, type Place } from '../../data/osm/trips';
import { loadDataset } from './load';

const ridership = ridershipRaw as RailRidership;

describe('reading the ticket-gate data', () => {
  test('splits station labels into code and name', () => {
    expect(splitStation('KJ29: SS 15')).toEqual({ code: 'KJ29', name: 'SS 15' });
    expect(splitStation('A0: All Stations')).toBeNull();
  });

  test('finds the station code in OpenStreetMap tags', () => {
    expect(stationCode({ name: 'KJ29 SS15' })).toBe('KJ29');
    expect(stationCode({ ref: 'KG10', name: 'Taman Tun Dr Ismail' })).toBe('KG10');
    expect(stationCode({ name: 'Subang Jaya' })).toBeNull();
  });

  test('takes the median weekday exits, ignoring weekends and other origins', () => {
    const rows = [
      'A0: All Stations,KJ29: SS 15,2026-10-12 00:00:00,5000', // Monday
      'A0: All Stations,KJ29: SS 15,2026-10-13 00:00:00,5200',
      'A0: All Stations,KJ29: SS 15,2026-10-14 00:00:00,9000', // an event day
      'A0: All Stations,KJ29: SS 15,2026-10-17 00:00:00,2500', // Saturday
      'KJ01: Gombak,KJ29: SS 15,2026-10-13 00:00:00,40',
    ];
    const summary = weekdayExits(rows, 1);
    expect(summary.stations['KJ29']).toEqual({ name: 'SS 15', weekdayExits: 5200 });
    expect(summary.to).toBe('2026-10-17');
  });

  test('the shipped file covers the stations in the shipped areas', () => {
    for (const code of ['KJ29', 'KG10', 'KG34', 'SP25']) {
      expect(ridership.stations[code]?.weekdayExits).toBeGreaterThan(0);
    }
    expect(exitsFor({ name: 'KJ29 SS15' }, ridership)?.exits).toBe(ridership.stations['KJ29']!.weekdayExits);
  });
});

describe('scaling walks to station exits', () => {
  test('one weight unit per 500 weekday exits', () => {
    expect(weightFromExits(5 * EXITS_PER_WEIGHT)).toBe(5);
  });

  test('walks from a counted station never add up to more than half its exits', () => {
    const station = { id: 'rail-station-1', dailyExits: 1000 } as Place;
    const walks = [
      { originId: 'rail-station-1', destinationId: 'mall-1', destinationKind: 'mall' as const, walkM: 300, trips: 900 },
      { originId: 'rail-station-1', destinationId: 'school-1', destinationKind: 'school' as const, walkM: 400, trips: 300 },
      { originId: 'bus-stop-1', destinationId: 'mall-1', destinationKind: 'mall' as const, walkM: 300, trips: 80 },
    ];
    const capped = capToExits(walks, [station]);
    const fromStation = capped.filter((w) => w.originId === 'rail-station-1').reduce((sum, w) => sum + w.trips, 0);
    expect(fromStation).toBeLessThanOrEqual(1000 * MAX_WALKING_SHARE);
    expect(capped[2]!.trips).toBe(80);
  });

  test('SS 15 walks from the LRT station follow its real exits', async () => {
    const area = await loadDataset('ss15-subang-jaya');
    const lrt = area.neighbourhood.destinations.find((d) => d.kind === 'rail-station')!;
    const fromLrt = area.journeys.filter((j) => j.originId === lrt.id).reduce((sum, j) => sum + j.dailyTrips, 0);
    const exits = ridership.stations['KJ29']!.weekdayExits;
    expect(fromLrt).toBeGreaterThan(0);
    expect(fromLrt).toBeLessThanOrEqual(exits * MAX_WALKING_SHARE);
    expect(area.neighbourhood.meta?.assumptions?.join(' ')).toContain('ticket-gate counts');
  });
});
