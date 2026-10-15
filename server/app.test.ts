import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, test } from 'vitest';
import type { ExplainRequest } from '../src/features/ai-scan/schemas';
import { createApp, MAX_IMAGE_BYTES, sniffImageType } from './app';
import { extractJson, templateSummary, type ClaudeClient } from './claude';
import { createRateLimiter } from './rateLimit';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const reply = (text: string): Anthropic.Message =>
  ({ content: [{ type: 'text', text }] }) as unknown as Anthropic.Message;

const fakeClient = (text: string): ClaudeClient => ({ createMessage: async () => reply(text) });
const failingClient: ClaudeClient = {
  createMessage: async () => {
    throw new Error('boom');
  },
};

const GOOD_SCAN = JSON.stringify({
  shadeFraction: 0.7,
  shadeSources: ['tree canopy'],
  obstacles: [],
  confidence: 'high',
  notes: 'Mostly shaded.',
});

function scanForm(over: { file?: File; segmentId?: string; time?: string } = {}): FormData {
  const form = new FormData();
  form.set('image', over.file ?? new File([PNG_BYTES], 'p.png', { type: 'image/png' }));
  form.set('segmentId', over.segmentId ?? 'seg-connector-1');
  form.set('time', over.time ?? '14:00');
  return form;
}

const post = (app: ReturnType<typeof createApp>, form: FormData) =>
  app.request('/api/shade-scan', { method: 'POST', body: form });

const noKeyApp = () => createApp({ getClient: () => null });

describe('GET /api/health', () => {
  test('returns ok', async () => {
    const res = await noKeyApp().request('/api/health');
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('POST /api/shade-scan validation', () => {
  test('rejects a missing image', async () => {
    const form = scanForm();
    form.delete('image');
    expect((await post(noKeyApp(), form)).status).toBe(400);
  });

  test('rejects unsupported file types', async () => {
    const file = new File(['hi'], 'x.txt', { type: 'text/plain' });
    expect((await post(noKeyApp(), scanForm({ file }))).status).toBe(400);
  });

  test('rejects a file whose bytes are not an image even if the type says so', async () => {
    const file = new File(['not an image at all'], 'x.png', { type: 'image/png' });
    expect((await post(noKeyApp(), scanForm({ file }))).status).toBe(400);
  });

  test('rejects photos over 5 MB', async () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.png', { type: 'image/png' });
    expect((await post(noKeyApp(), scanForm({ file: big }))).status).toBe(413);
  });

  test('rejects bad segment ids and time slots', async () => {
    expect((await post(noKeyApp(), scanForm({ segmentId: '../etc' }))).status).toBe(400);
    expect((await post(noKeyApp(), scanForm({ time: '03:00' }))).status).toBe(400);
  });
});

describe('POST /api/shade-scan results', () => {
  test('falls back to a labelled mock when there is no API key', async () => {
    const body = await (await post(noKeyApp(), scanForm())).json();
    expect(body).toMatchObject({ isMock: true, segmentId: 'seg-connector-1', confidence: 'low' });
    expect(body.notes).toMatch(/MOCK/);
  });

  test('returns the validated Claude estimate', async () => {
    const app = createApp({ getClient: () => fakeClient(GOOD_SCAN) });
    const body = await (await post(app, scanForm())).json();
    expect(body).toMatchObject({ isMock: false, shadeFraction: 0.7, confidence: 'high' });
  });

  test('accepts JSON wrapped in code fences', async () => {
    const app = createApp({ getClient: () => fakeClient('```json\n' + GOOD_SCAN + '\n```') });
    expect((await (await post(app, scanForm())).json()).isMock).toBe(false);
  });

  test('falls back to mock on invalid JSON, out-of-range values and API errors', async () => {
    const bad = JSON.stringify({ ...JSON.parse(GOOD_SCAN), shadeFraction: 4 });
    for (const client of [fakeClient('sorry, no'), fakeClient(bad), failingClient]) {
      const app = createApp({ getClient: () => client });
      const res = await post(app, scanForm());
      expect(res.status).toBe(200);
      expect((await res.json()).isMock).toBe(true);
    }
  });
});

const PLAN: ExplainRequest = {
  interventionIds: ['shelter-connector'],
  installCost: 18000,
  annualMaintenance: 450,
  sunMinutesAvoidedPerDay: 2820,
  pedestrianSunMinutesAvoided: 2820,
  journeys: [],
  journeysImproved: ['j1', 'j2'],
  contributions: { 'shelter-connector': 2820 },
  interventionNames: { 'shelter-connector': 'Connector shelter (240 m)' },
};

const postJson = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request('/api/explain', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/explain', () => {
  test('uses a numbers-only template when there is no key', async () => {
    const body = await (await postJson(noKeyApp(), PLAN)).json();
    expect(body.isMock).toBe(true);
    expect(body.summary).toContain('RM 18,000');
    expect(body.summary).toContain('47.0 pedestrian-hours');
    expect(body.summary).not.toMatch(/cooler|healthy|safe route/i);
  });

  test('returns the model summary when a client is available', async () => {
    const app = createApp({ getClient: () => fakeClient('A short summary.') });
    expect(await (await postJson(app, PLAN)).json()).toEqual({ summary: 'A short summary.', isMock: false });
  });

  test('falls back to the template when the API fails', async () => {
    const app = createApp({ getClient: () => failingClient });
    expect((await (await postJson(app, PLAN)).json()).isMock).toBe(true);
  });

  test('rejects an empty or malformed plan', async () => {
    expect((await postJson(noKeyApp(), { nope: 1 })).status).toBe(400);
    expect((await postJson(noKeyApp(), { ...PLAN, interventionIds: [] })).status).toBe(400);
  });
});

describe('rate limiting', () => {
  test('returns 429 when the limiter refuses', async () => {
    const app = createApp({ getClient: () => null, allow: () => false });
    expect((await postJson(app, PLAN)).status).toBe(429);
    expect((await app.request('/api/health')).status).toBe(200);
  });

  test('createRateLimiter allows `limit` requests per window then recovers', () => {
    let now = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    expect([allow('a'), allow('a'), allow('a')]).toEqual([true, true, false]);
    expect(allow('b')).toBe(true);
    now = 1500;
    expect(allow('a')).toBe(true);
  });
});

describe('helpers', () => {
  test('sniffImageType recognises jpeg, png and webp', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(PNG_BYTES)).toBe('image/png');
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageType(webp)).toBe('image/webp');
    expect(sniffImageType(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  test('extractJson finds the object inside prose and throws without one', () => {
    expect(extractJson('here: {"a":1} done')).toEqual({ a: 1 });
    expect(() => extractJson('nothing')).toThrow();
  });

  test('templateSummary handles a plan with no contributions', () => {
    expect(templateSummary({ ...PLAN, contributions: {} })).toContain('This plan installs');
  });
});
