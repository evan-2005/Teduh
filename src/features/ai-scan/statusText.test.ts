import { describe, expect, test } from 'vitest';
import { describeStatus } from './statusText';

describe('describeStatus', () => {
  test('tells the user to start the server when it is unreachable', () => {
    const text = describeStatus({ mode: 'unreachable' });
    expect(text.tone).toBe('error');
    expect(text.fix).toContain('npm run dev:server');
  });

  test('names the model when ready', () => {
    expect(describeStatus({ mode: 'ollama', ready: true, model: 'qwen2.5vl:7b' })).toEqual({
      tone: 'ok',
      title: 'AI ready: a local model (qwen2.5vl:7b).',
    });
    expect(describeStatus({ mode: 'claude', ready: true }).title).toBe('AI ready: Claude.');
  });

  test('passes on the server problem and fix', () => {
    const text = describeStatus({ mode: 'ollama', ready: false, problem: 'The model x is not downloaded.', fix: 'ollama pull x' });
    expect(text).toMatchObject({ tone: 'error', title: 'The model x is not downloaded.', fix: 'ollama pull x' });
  });

  test('mock mode is a warning that still lets the scan run', () => {
    const text = describeStatus({ mode: 'mock', ready: false, problem: 'No AI is set up.', fix: 'set AI_PROVIDER' });
    expect(text.tone).toBe('warn');
    expect(text.detail).toMatch(/MOCK/);
  });
});
