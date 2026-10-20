import { describe, expect, test } from 'vitest';
import type { SuggestRequest } from '../features/ai-scan/schemas';
import { cleanSuggestion, ruleSuggestion } from './suggestSettings';

const request = (description: string): SuggestRequest => ({
  area: 'SS 15, Subang Jaya',
  description,
  currentDetourLimit: 0.25,
  destinations: [
    { id: 'mall', name: 'Shopping mall', kind: 'mall', tripsPerDay: 680 },
    { id: 'clinic', name: 'Clinic', kind: 'clinic', tripsPerDay: 200 },
    { id: 'college', name: 'College', kind: 'school', tripsPerDay: 250 },
    { id: 'park', name: 'Park', kind: 'park', tripsPerDay: 20 },
  ],
  startPoints: [{ id: 'lrt', name: 'LRT station', kind: 'rail-station', tripsPerDay: 1100 }],
});
const weightOf = (s: { weights: { id: string; weight: number }[] }, id: string) => s.weights.find((w) => w.id === id)?.weight;

describe('ruleSuggestion', () => {
  test('with no description, keeps everything as it is and says why', () => {
    const s = ruleSuggestion(request(''));
    expect(s.detourLimit).toBe(0.25);
    expect(s.weights.every((w) => w.weight === 1)).toBe(true);
    expect(s.summary).toMatch(/describe/i);
    expect(s.isMock).toBe(true);
  });

  test('older residents raise the clinic and shorten the detour', () => {
    const s = ruleSuggestion(request('Many elderly residents live near the station'));
    expect(weightOf(s, 'clinic')).toBe(2);
    expect(weightOf(s, 'park')).toBe(1.25);
    expect(weightOf(s, 'mall')).toBe(1);
    expect(s.detourLimit).toBe(0.15);
    expect(s.weights.find((w) => w.id === 'clinic')?.reason).toMatch(/older residents/);
  });

  test('students raise the college; mixed groups take the larger weight and the shorter detour', () => {
    const s = ruleSuggestion(request('University students and some older people'));
    expect(weightOf(s, 'college')).toBe(2);
    expect(weightOf(s, 'clinic')).toBe(2);
    expect(s.detourLimit).toBe(0.15);
  });
});

describe('cleanSuggestion', () => {
  const req = request('students');

  test('snaps and clamps to the slider ranges and fills in missing places', () => {
    const s = cleanSuggestion(
      { detourLimit: 0.33, detourReason: 'ok', weights: [{ id: 'college', weight: 7.1, reason: 'students' }], summary: 'fine' },
      req,
      'a local model (x)',
    );
    expect(s.detourLimit).toBe(0.35);
    expect(weightOf(s, 'college')).toBe(5);
    expect(weightOf(s, 'mall')).toBe(1);
    expect(s.weights).toHaveLength(4);
    expect(s).toMatchObject({ isMock: false, source: 'a local model (x)' });
  });

  test('drops places the area does not have', () => {
    const s = cleanSuggestion({ detourLimit: 0.2, detourReason: '', weights: [{ id: 'airport', weight: 3, reason: 'x' }], summary: '' }, req, 'm');
    expect(s.weights.some((w) => w.id === 'airport')).toBe(false);
  });

  test('replaces reasons that claim health, safety or temperature benefits', () => {
    const s = cleanSuggestion(
      { detourLimit: 0.2, detourReason: 'Safer for kids', weights: [{ id: 'park', weight: 2, reason: 'Healthy walks' }], summary: 'Cooler streets' },
      req,
      'm',
    );
    expect(JSON.stringify(s)).not.toMatch(/safer|healthy|cooler/i);
  });
});
