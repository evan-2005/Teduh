import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, test } from 'vitest';
import type { SuggestRequest } from '../src/features/ai-scan/schemas';
import { createApp } from './app';
import { createClaudeProvider } from './claude';
import { createOllamaProvider } from './ollama';
import { suggestionFromReply } from './suggest';

const REQUEST: SuggestRequest = {
  area: 'SS 15, Subang Jaya',
  description: 'Lots of university students',
  currentDetourLimit: 0.25,
  destinations: [
    { id: 'college', name: 'College', kind: 'school', tripsPerDay: 250 },
    { id: 'mall', name: 'Shopping mall', kind: 'mall', tripsPerDay: 680 },
  ],
  startPoints: [{ id: 'lrt', name: 'LRT station', kind: 'rail-station', tripsPerDay: 1100 }],
};
const GOOD = JSON.stringify({
  detourLimit: 0.3,
  detourReason: 'Students accept longer shaded routes.',
  weights: [{ id: 'college', weight: 2.5, reason: 'Many students walk to the college.' }],
  summary: 'Weighted towards the college.',
});

describe('suggestionFromReply', () => {
  test('uses a valid model reply, cleaned to the app', () => {
    const s = suggestionFromReply(GOOD, REQUEST, 'Claude');
    expect(s).toMatchObject({ detourLimit: 0.3, isMock: false, source: 'Claude' });
    expect(s.weights.find((w) => w.id === 'college')?.weight).toBe(2.5);
  });

  test('falls back to the labelled rules when the reply is not usable', () => {
    const s = suggestionFromReply('not json', REQUEST, 'Claude');
    expect(s.isMock).toBe(true);
    expect(s.summary).toMatch(/could not be used/);
    expect(s.weights.find((w) => w.id === 'college')?.weight).toBe(2);
  });
});

describe('providers', () => {
  test('Claude sends the facts and returns its suggestion', async () => {
    let sent = '';
    const provider = createClaudeProvider({
      createMessage: async (params) => {
        sent = JSON.stringify(params.messages);
        return { content: [{ type: 'text', text: GOOD }] } as unknown as Anthropic.Message;
      },
    });
    const s = await provider.suggestSettings(REQUEST);
    expect(sent).toContain('Lots of university students');
    expect(s.source).toBe('Claude');
  });

  test('Ollama returns rules when it is not running', async () => {
    const provider = createOllamaProvider({
      url: 'http://localhost:11434',
      model: 'm',
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });
    const s = await provider.suggestSettings(REQUEST);
    expect(s.isMock).toBe(true);
    expect(s.summary).toMatch(/not reachable/);
  });
});

describe('POST /api/suggest-settings', () => {
  const post = (body: unknown) =>
    createApp({ getProvider: () => null }).request('/api/suggest-settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  test('returns rule-based suggestions when no AI is set up', async () => {
    const res = await post(REQUEST);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ isMock: true, detourLimit: 0.3 });
  });

  test('rejects a request without destinations', async () => {
    expect((await post({ ...REQUEST, destinations: [] })).status).toBe(400);
  });
});
