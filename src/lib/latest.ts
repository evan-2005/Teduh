/**
 * Tracks which async request is the newest, so a slow reply to an older request can be ignored.
 * `start()` marks a new request and returns a check that stays true only while it is the newest.
 * `cancel()` makes every request started so far stale (e.g. when its input changes).
 */
export interface LatestTracker {
  start: () => () => boolean;
  cancel: () => void;
}

export function createLatestTracker(): LatestTracker {
  let current = 0;
  return {
    start: () => {
      current += 1;
      const id = current;
      return () => id === current;
    },
    cancel: () => {
      current += 1;
    },
  };
}
