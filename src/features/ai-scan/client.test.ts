import { describe, expect, test } from 'vitest';
import { AiClientError, requestExplanation, requestShadeScan, type FetchLike } from './client';
import { explainRequestSchema, shadeScanResultSchema } from './schemas';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const GOOD_SCAN = {
  segmentId: 's1',
  shadeFraction: 0.6,
  shadeSources: ['tree canopy'],
  obstacles: [],
  confidence: 'medium',
  notes: 'ok',
  isMock: false,
};

const scanArgs = {
  image: new File([new Uint8Array([1])], 'p.png', { type: 'image/png' }),
  segmentId: 's1',
  time: '14:00' as const,
};

const rejects = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AiClientError);
    return (error as Error).message;
  }
  throw new Error('expected the request to fail');
};

describe('schemas', () => {
  test('accept a good scan result', () => {
    expect(shadeScanResultSchema.safeParse(GOOD_SCAN).success).toBe(true);
  });

  test.each([
    ['shadeFraction above 1', { ...GOOD_SCAN, shadeFraction: 1.2 }],
    ['unknown confidence', { ...GOOD_SCAN, confidence: 'certain' }],
    ['missing isMock', { ...GOOD_SCAN, isMock: undefined }],
    ['non-string source', { ...GOOD_SCAN, shadeSources: [3] }],
  ])('reject %s', (_name, value) => {
    expect(shadeScanResultSchema.safeParse(value).success).toBe(false);
  });

  test('explain request needs at least one intervention', () => {
    expect(explainRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('requestShadeScan', () => {
  test('returns a validated result and posts multipart form data', async () => {
    let seen: RequestInit | undefined;
    const fetchImpl: FetchLike = async (_url, init) => {
      seen = init;
      return json(GOOD_SCAN);
    };
    const result = await requestShadeScan(scanArgs, fetchImpl);
    expect(result.shadeFraction).toBe(0.6);
    expect(seen?.body).toBeInstanceOf(FormData);
  });

  test('turns a 500 into a friendly message', async () => {
    const message = await rejects(requestShadeScan(scanArgs, async () => json({}, 500)));
    expect(message).toMatch(/had a problem/);
    expect(message).not.toMatch(/500/);
  });

  test('turns a network failure into a friendly message', async () => {
    const message = await rejects(
      requestShadeScan(scanArgs, async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(message).toMatch(/API server running/);
  });

  test('shows the server message for a 4xx', async () => {
    const message = await rejects(
      requestShadeScan(scanArgs, async () => json({ error: 'Photo is larger than 5 MB.' }, 413)),
    );
    expect(message).toBe('Photo is larger than 5 MB.');
  });

  test('explains rate limiting and rejects replies that fail validation', async () => {
    expect(await rejects(requestShadeScan(scanArgs, async () => json({}, 429)))).toMatch(/Too many/);
    expect(
      await rejects(requestShadeScan(scanArgs, async () => json({ ...GOOD_SCAN, shadeFraction: 9 }))),
    ).toMatch(/could not read/);
  });
});

describe('requestExplanation', () => {
  const plan = {
    interventionIds: ['a'],
    installCost: 1,
    annualMaintenance: 1,
    sunMinutesAvoidedPerDay: 1,
    journeys: [],
    journeysImproved: [],
    contributions: {},
  };

  test('returns the summary', async () => {
    const result = await requestExplanation(plan, async () => json({ summary: 'Hi.', isMock: true }));
    expect(result).toEqual({ summary: 'Hi.', isMock: true });
  });

  test('rejects an empty summary', async () => {
    await rejects(requestExplanation(plan, async () => json({ summary: '', isMock: false })));
  });
});
