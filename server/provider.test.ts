import { describe, expect, test } from 'vitest';
import { hasBannedClaim } from './ai';
import { selectProvider } from './provider';

describe('selectProvider', () => {
  test('uses Ollama with default url and model when AI_PROVIDER=ollama', () => {
    const provider = selectProvider({ AI_PROVIDER: 'ollama' });
    expect(provider?.name).toBe('a local model (gemma3:4b)');
  });

  test('uses the configured Ollama model even when a Claude key is set', () => {
    const provider = selectProvider({
      AI_PROVIDER: 'Ollama',
      OLLAMA_MODEL: 'qwen2.5vl:3b',
      ANTHROPIC_API_KEY: 'sk-test',
    });
    expect(provider?.name).toBe('a local model (qwen2.5vl:3b)');
  });

  test('uses Claude when only ANTHROPIC_API_KEY is set', () => {
    expect(selectProvider({ ANTHROPIC_API_KEY: 'sk-test' })?.name).toBe('Claude');
  });

  test('returns null (mock mode) with neither', () => {
    expect(selectProvider({})).toBeNull();
    expect(selectProvider({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' })).toBeNull();
  });
});

describe('hasBannedClaim', () => {
  test.each([
    'The street will be cooler.',
    'Cooling effect on the route.',
    'Lower TEMPERATURE at noon.',
    'Good for health.',
    'A healthy walk.',
    'A safe path.',
    'Improves safety.',
  ])('flags "%s"', (text) => {
    expect(hasBannedClaim(text)).toBe(true);
  });

  test('allows plain shade and cost wording', () => {
    expect(hasBannedClaim('This plan installs two shelters for RM 18,000 and adds shade.')).toBe(false);
    expect(hasBannedClaim('The school and the mall are on the improved routes.')).toBe(false);
  });
});
