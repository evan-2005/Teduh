import { z } from 'zod';
import type { AiStatus } from '../src/features/ai-scan/schemas';
import { DEFAULT_OLLAMA_MODEL, ollamaUrl, type AiEnv } from './provider';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Asking Ollama for its model list is instant when it runs; don't hang the page when it doesn't. */
const STATUS_TIMEOUT_MS = 3000;
const RESTART = 'then restart the AI server (stop it with Ctrl+C and run npm run dev:server again).';

const tagsSchema = z.object({ models: z.array(z.object({ name: z.string() })) });

/** "llava" means "llava:latest" to Ollama. */
const sameModel = (installed: string, wanted: string): boolean =>
  installed === wanted || (!wanted.includes(':') && installed === `${wanted}:latest`);

async function installedModels(url: string, fetchImpl: FetchLike): Promise<string[] | { problem: string; fix: string }> {
  let response: Response;
  try {
    response = await fetchImpl(`${url}/api/tags`, { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) });
  } catch {
    return {
      problem: `Ollama is not running at ${url}.`,
      fix: 'Install Ollama from https://ollama.com and start it (Windows: Start menu → Ollama; Mac: open the Ollama app). Then click Check again.',
    };
  }
  if (!response.ok) {
    return { problem: `Ollama answered with error ${response.status}.`, fix: 'Restart Ollama, then click Check again.' };
  }
  const parsed = tagsSchema.safeParse(await response.json().catch(() => null));
  return parsed.success
    ? parsed.data.models.map((m) => m.name)
    : { problem: 'Ollama sent a reply the app could not read.', fix: 'Update Ollama, then click Check again.' };
}

async function ollamaStatus(env: AiEnv, fetchImpl: FetchLike): Promise<AiStatus> {
  const model = env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL;
  const models = await installedModels(ollamaUrl(env), fetchImpl);
  if (!Array.isArray(models)) return { mode: 'ollama', ready: false, model, ...models };
  if (models.some((m) => sameModel(m, model))) return { mode: 'ollama', ready: true, model };
  const others = models.length > 0 ? ` Or use a model you already have: set OLLAMA_MODEL=${models[0]} in .env, ${RESTART}` : '';
  return {
    mode: 'ollama',
    ready: false,
    model,
    problem: `The model ${model} is not downloaded.`,
    fix: `In a terminal run: ollama pull ${model}${others}`,
  };
}

/**
 * Which AI the server will use and whether it can, in plain words a teammate can act on.
 * Never includes the API key.
 */
export async function aiStatus(env: AiEnv, fetchImpl: FetchLike = fetch): Promise<AiStatus> {
  if (env.AI_PROVIDER?.trim().toLowerCase() === 'ollama') return ollamaStatus(env, fetchImpl);
  if (env.ANTHROPIC_API_KEY?.trim()) return { mode: 'claude', ready: true, model: 'Claude' };
  return {
    mode: 'mock',
    ready: false,
    problem: 'No AI is set up on the server, so results are labelled MOCK.',
    fix: `In the .env file set AI_PROVIDER=ollama and OLLAMA_MODEL=qwen2.5vl:7b (a free model on this laptop), or ANTHROPIC_API_KEY=… (Claude), ${RESTART}`,
  };
}
