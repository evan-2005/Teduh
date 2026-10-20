import { describe, expect, test } from 'vitest';
import { aiStatus } from './status';

const tags = (...names: string[]) => async () =>
  new Response(JSON.stringify({ models: names.map((name) => ({ name })) }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const down = async (): Promise<Response> => {
  throw new TypeError('fetch failed');
};

describe('aiStatus', () => {
  test('mock mode explains how to turn the AI on', async () => {
    const status = await aiStatus({});
    expect(status.mode).toBe('mock');
    expect(status.ready).toBe(false);
    expect(status.fix).toContain('AI_PROVIDER=ollama');
  });

  test('Claude mode is ready when a key is set, and never echoes the key', async () => {
    const status = await aiStatus({ ANTHROPIC_API_KEY: 'sk-secret-123' });
    expect(status).toMatchObject({ mode: 'claude', ready: true });
    expect(JSON.stringify(status)).not.toContain('sk-secret-123');
  });

  test('Ollama not running', async () => {
    const status = await aiStatus({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen2.5vl:7b' }, down);
    expect(status).toMatchObject({ mode: 'ollama', ready: false, model: 'qwen2.5vl:7b' });
    expect(status.problem).toMatch(/not running/i);
  });

  test('model not downloaded names the pull command and the models that are installed', async () => {
    const status = await aiStatus({ AI_PROVIDER: 'ollama' }, tags('qwen2.5vl:7b'));
    expect(status.ready).toBe(false);
    expect(status.model).toBe('gemma3:4b');
    expect(status.fix).toContain('ollama pull gemma3:4b');
    expect(status.fix).toContain('OLLAMA_MODEL=qwen2.5vl:7b');
  });

  test('ready when the model is installed, matching an untagged name to :latest', async () => {
    expect(await aiStatus({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'qwen2.5vl:7b' }, tags('qwen2.5vl:7b'))).toMatchObject({ ready: true });
    expect(await aiStatus({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'llava' }, tags('llava:latest'))).toMatchObject({ ready: true });
  });

  test('an Ollama error reply is reported, not thrown', async () => {
    const status = await aiStatus({ AI_PROVIDER: 'ollama' }, async () => new Response('nope', { status: 500 }));
    expect(status.ready).toBe(false);
    expect(status.problem).toMatch(/500/);
  });
});
