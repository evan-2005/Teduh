import { describe, expect, test } from 'vitest';
import { createLatestTracker } from './latest';

describe('createLatestTracker', () => {
  test('only the newest request stays current', () => {
    const tracker = createLatestTracker();
    const first = tracker.start();
    expect(first()).toBe(true);
    const second = tracker.start();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  test('cancel makes an in-flight request stale', () => {
    const tracker = createLatestTracker();
    const pending = tracker.start();
    tracker.cancel();
    expect(pending()).toBe(false);
  });

  test('a slow reply to an older request is dropped', async () => {
    const tracker = createLatestTracker();
    const shown: string[] = [];
    const request = async (text: string, delayMs: number) => {
      const isCurrent = tracker.start();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (isCurrent()) shown.push(text);
    };
    await Promise.all([request('old plan', 30), request('new plan', 5)]);
    expect(shown).toEqual(['new plan']);
  });
});
