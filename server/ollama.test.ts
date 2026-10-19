import { describe, expect, test } from 'vitest';
import type { ExplainRequest } from '../src/features/ai-scan/schemas';
import { createOllamaProvider, type OllamaOptions } from './ollama';

const URL = 'http://localhost:11434';
const MODEL = 'gemma3:4b';
const IMAGE = { base64: 'aGVsbG8=', mediaType: 'image/png' as const };

const GOOD_SCAN = {
  shadeFraction: 0.65,
  shadeSources: ['tree canopy'],
  obstacles: [],
  confidence: 'medium',
  notes: 'Trees shade most of the path.',
};

const PLAN: ExplainRequest = {
  interventionIds: ['shelter-connector'],
  installCost: 18000,
  annualMaintenance: 450,
  sunMinutesAvoidedPerDay: 2820,
  journeys: [],
  journeysImproved: ['j1'],
  contributions: { 'shelter-connector': 2820 },
};

type FetchFn = NonNullable<OllamaOptions['fetchImpl']>;

const chatReply = (content: string, status = 200): Response =>
  new Response(JSON.stringify({ message: { role: 'assistant', content }, done: true }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** A fake fetch that records each call and answers with `respond`. */
function fakeFetch(respond: (init: RequestInit) => Promise<Response>) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl: FetchFn = async (url, init = {}) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return respond(init);
  };
  return { calls, fetchImpl };
}

const provider = (fetchImpl: FetchFn, timeoutMs?: number) =>
  createOllamaProvider({ url: URL, model: MODEL, fetchImpl, timeoutMs });

describe('Ollama shade scan', () => {
  test('returns the validated estimate labelled with the local model', async () => {
    const { fetchImpl } = fakeFetch(async () => chatReply(JSON.stringify(GOOD_SCAN)));
    const result = await provider(fetchImpl).scanShade(IMAGE, 'seg-1', '14:00');
    expect(result).toMatchObject({ ...GOOD_SCAN, segmentId: 'seg-1', isMock: false });
    expect(result.source).toContain(MODEL);
  });

  test('sends the image, model, time slot and a JSON schema format to /api/chat', async () => {
    const { calls, fetchImpl } = fakeFetch(async () => chatReply(JSON.stringify(GOOD_SCAN)));
    await provider(fetchImpl).scanShade(IMAGE, 'seg-1', '09:00');
    expect(calls[0]!.url).toBe(`${URL}/api/chat`);
    const body = calls[0]!.body as {
      model: string;
      stream: boolean;
      messages: { content: string; images: string[] }[];
      format: { type: string; properties: Record<string, unknown> };
    };
    expect(body.model).toBe(MODEL);
    expect(body.stream).toBe(false);
    expect(body.messages[0]!.images).toEqual([IMAGE.base64]);
    expect(body.messages[0]!.content).toContain('09:00');
    expect(body.format.type).toBe('object');
    expect(Object.keys(body.format.properties)).toContain('shadeFraction');
  });

  test.each([
    ['prose instead of JSON', 'sorry, I cannot see the photo'],
    ['an out-of-range shadeFraction', JSON.stringify({ ...GOOD_SCAN, shadeFraction: 3 })],
  ])('falls back to a labelled mock on %s', async (_label, content) => {
    const { fetchImpl } = fakeFetch(async () => chatReply(content));
    const result = await provider(fetchImpl).scanShade(IMAGE, 'seg-1', '14:00');
    expect(result).toMatchObject({ isMock: true, segmentId: 'seg-1', confidence: 'low' });
    expect(result.notes).toMatch(/MOCK/);
    expect(result.source).toBeUndefined();
  });

  test('falls back to mock on an HTTP 500', async () => {
    const { fetchImpl } = fakeFetch(async () => chatReply('{}', 500));
    const result = await provider(fetchImpl).scanShade(IMAGE, 'seg-1', '14:00');
    expect(result.isMock).toBe(true);
    expect(result.notes).toMatch(/500/);
  });

  test('says how to fix a missing model (HTTP 404)', async () => {
    const { fetchImpl } = fakeFetch(async () => chatReply('{}', 404));
    const result = await provider(fetchImpl).scanShade(IMAGE, 'seg-1', '14:00');
    expect(result.isMock).toBe(true);
    expect(result.notes).toContain(`ollama pull ${MODEL}`);
  });

  test('falls back to mock with a clear reason when Ollama is not running', async () => {
    const { fetchImpl } = fakeFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const result = await provider(fetchImpl).scanShade(IMAGE, 'seg-1', '14:00');
    expect(result.isMock).toBe(true);
    expect(result.notes).toMatch(/Ollama is not reachable/);
  });

  test('falls back to mock when the model takes too long', async () => {
    const { fetchImpl } = fakeFetch(
      (init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const result = await provider(fetchImpl, 10).scanShade(IMAGE, 'seg-1', '14:00');
    expect(result.isMock).toBe(true);
    expect(result.notes).toMatch(/timed out/);
  });
});

describe('Ollama plan explainer', () => {
  test('returns the model summary with a source label', async () => {
    const { calls, fetchImpl } = fakeFetch(async () => chatReply('  This plan adds one shelter.  '));
    const response = await provider(fetchImpl).explainPlan(PLAN);
    expect(response).toMatchObject({ summary: 'This plan adds one shelter.', isMock: false });
    expect(response.source).toContain(MODEL);
    const messages = calls[0]!.body['messages'] as { role: string; content: string }[];
    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(messages[1]!.content).toContain('18000');
  });

  test('falls back to the template when the reply makes a banned claim', async () => {
    const { fetchImpl } = fakeFetch(async () => chatReply('Walks will feel much cooler.'));
    const response = await provider(fetchImpl).explainPlan(PLAN);
    expect(response.isMock).toBe(true);
    expect(response.summary).toContain('This plan installs');
    expect(response.source).toBeUndefined();
  });

  test('falls back to the template when Ollama is down', async () => {
    const { fetchImpl } = fakeFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const response = await provider(fetchImpl).explainPlan(PLAN);
    expect(response.isMock).toBe(true);
    expect(response.summary).toContain('RM 18,000');
  });
});
