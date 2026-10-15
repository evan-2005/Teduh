const DEFAULT_LIMIT = 20;
const DEFAULT_WINDOW_MS = 60_000;

export interface RateLimiterOptions {
  limit?: number;
  windowMs?: number;
  now?: () => number;
}

/** Simple in-memory sliding window. Returns true when the request is allowed. */
export function createRateLimiter(options: RateLimiterOptions = {}): (key: string) => boolean {
  const { limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS, now = Date.now } = options;
  const hits = new Map<string, number[]>();

  return (key) => {
    const cutoff = now() - windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now()]);
    return true;
  };
}
