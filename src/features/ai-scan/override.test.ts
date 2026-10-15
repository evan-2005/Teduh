import { describe, expect, test } from 'vitest';
import type { ShadeScanResult } from '../../types';
import { overrideFromScan } from './override';

const result: ShadeScanResult = {
  segmentId: 'seg-10',
  shadeFraction: 0.4,
  shadeSources: [],
  obstacles: [],
  confidence: 'medium',
  notes: '',
  isMock: false,
};

describe('overrideFromScan', () => {
  test('targets the scanned segment and time, with the value the person chose', () => {
    expect(overrideFromScan({ result, time: '09:00' }, 0.65)).toEqual({
      segmentId: 'seg-10',
      time: '09:00',
      shade: 0.65,
      source: 'ai-confirmed',
    });
  });
});
