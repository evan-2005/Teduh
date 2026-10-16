import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DEMO_TIME } from '../config';
import { demoLabel } from '../lib/format';
import type { Journey, Neighbourhood } from '../types';
import { dataset, meta } from './dataset';
import { demoWalkNames } from './meta';

const readArea = (slug: string) => ({
  neighbourhood: JSON.parse(readFileSync(`data/areas/${slug}/neighbourhood.json`, 'utf8')) as Neighbourhood,
  journeys: JSON.parse(readFileSync(`data/areas/${slug}/journeys.json`, 'utf8')) as Journey[],
});

describe('demo preset label', () => {
  test('seed dataset: the demo walks from a home cluster to the shop row', () => {
    const walk = demoWalkNames(dataset.neighbourhood, dataset.journeys, meta.demoJourneyId);
    expect(demoLabel(DEMO_TIME, walk)).toBe('Demo: 2 pm walk from the home cluster A to the shop row');
  });

  test.each([
    ['ss15-subang-jaya', 'Demo: 2 pm walk from the LRT station to the shopping mall'],
    ['kajang-town', 'Demo: 2 pm walk from the MRT station to the hospital'],
    ['bandar-baru-bangi', 'Demo: 2 pm walk from homes (east) to the school'],
  ])('%s: the label follows the demo journey in its data', (slug, label) => {
    const { neighbourhood, journeys } = readArea(slug);
    const walk = demoWalkNames(neighbourhood, journeys, neighbourhood.meta!.demoJourneyId);
    expect(demoLabel(DEMO_TIME, walk)).toBe(label);
  });

  test('an unknown demo journey gives null instead of wrong names', () => {
    expect(demoWalkNames(dataset.neighbourhood, dataset.journeys, 'no-such-journey')).toBeNull();
  });
});
