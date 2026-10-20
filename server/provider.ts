import type { AiProvider } from './ai';
import { clientFromKey, createClaudeProvider } from './claude';
import { createOllamaProvider } from './ollama';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'gemma3:4b';

export type AiEnv = Partial<
  Record<'AI_PROVIDER' | 'OLLAMA_URL' | 'OLLAMA_MODEL' | 'OLLAMA_TIMEOUT_MS' | 'ANTHROPIC_API_KEY', string>
>;

export const ollamaUrl = (env: AiEnv): string =>
  (env.OLLAMA_URL?.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');

function timeoutFrom(value: string | undefined): number | undefined {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}

/**
 * AI_PROVIDER=ollama uses a local model; otherwise Claude when ANTHROPIC_API_KEY is set;
 * otherwise null, which means labelled mock results.
 */
export function selectProvider(env: AiEnv): AiProvider | null {
  if (env.AI_PROVIDER?.trim().toLowerCase() === 'ollama') {
    return createOllamaProvider({
      url: ollamaUrl(env),
      model: env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL,
      timeoutMs: timeoutFrom(env.OLLAMA_TIMEOUT_MS),
    });
  }
  const client = clientFromKey(env.ANTHROPIC_API_KEY);
  return client ? createClaudeProvider(client) : null;
}

/** One line for the startup log. Never includes the key. */
export function describeMode(env: AiEnv): string {
  const provider = selectProvider(env);
  if (!provider) return 'mock mode (no ANTHROPIC_API_KEY and AI_PROVIDER is not ollama)';
  if (provider.name === 'Claude') return 'Claude mode';
  return `local mode: ${provider.name} at ${ollamaUrl(env)}`;
}
