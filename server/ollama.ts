import { z } from 'zod';
import {
  shadeScanBodySchema,
  type ExplainRequest,
  type ExplainResponse,
} from '../src/features/ai-scan/schemas';
import type { ShadeScanResult, TimeSlot } from '../src/types';
import {
  explanationFromReply,
  mockShadeResult,
  scanFromReply,
  templateResponse,
  type AiProvider,
  type ScanImage,
} from './ai';
import { EXPLAIN_SYSTEM, planFacts, shadePrompt } from './prompts';

/** The first call loads the model into GPU memory, which can take tens of seconds. */
export const DEFAULT_TIMEOUT_MS = 60_000;
const MS_PER_SECOND = 1000;
const MAX_REPLY_TOKENS = 500;
const SCAN_TEMPERATURE = 0;
const EXPLAIN_TEMPERATURE = 0.3;
/** Keep the model loaded between demo clicks instead of Ollama's 5-minute default. */
const KEEP_ALIVE = '30m';
const HTTP_NOT_FOUND = 404;

export interface OllamaOptions {
  url: string;
  model: string;
  timeoutMs?: number | undefined;
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
}

/** Ollama constrains its output to this schema; the reply is still validated with zod. */
const { $schema: _unused, ...SHADE_FORMAT } = z.toJSONSchema(shadeScanBodySchema);

const chatReplySchema = z.object({ message: z.object({ content: z.string() }) });

class OllamaHttpError extends Error {
  constructor(readonly status: number) {
    super(`Ollama HTTP ${status}`);
  }
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
  images?: string[];
}

interface ChatRequest {
  messages: ChatMessage[];
  temperature: number;
  format?: object;
}

async function chat(options: OllamaOptions, request: ChatRequest): Promise<string> {
  const { url, model, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = options;
  const response = await fetchImpl(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      stream: false,
      keep_alive: KEEP_ALIVE,
      messages: request.messages,
      ...(request.format ? { format: request.format } : {}),
      options: { temperature: request.temperature, num_predict: MAX_REPLY_TOKENS },
    }),
  });
  if (!response.ok) throw new OllamaHttpError(response.status);
  return chatReplySchema.parse(await response.json()).message.content;
}

function reasonFrom(error: unknown, options: OllamaOptions): string {
  const seconds = Math.round((options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / MS_PER_SECOND);
  if (error instanceof OllamaHttpError) {
    return error.status === HTTP_NOT_FOUND
      ? `model ${options.model} is not installed; run "ollama pull ${options.model}"`
      : `Ollama error ${error.status}`;
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return `the local model timed out after ${seconds} s`;
  }
  if (error instanceof TypeError) return `Ollama is not reachable at ${options.url}; is it running?`;
  return 'AI reply could not be used';
}

async function scanShade(
  options: OllamaOptions,
  name: string,
  call: { image: ScanImage; segmentId: string; time: TimeSlot },
): Promise<ShadeScanResult> {
  try {
    const text = await chat(options, {
      messages: [{ role: 'user', content: shadePrompt(call.time), images: [call.image.base64] }],
      format: SHADE_FORMAT,
      temperature: SCAN_TEMPERATURE,
    });
    return scanFromReply(text, call.segmentId, name);
  } catch (error) {
    return mockShadeResult(call.segmentId, reasonFrom(error, options));
  }
}

async function explainPlan(
  options: OllamaOptions,
  name: string,
  plan: ExplainRequest,
): Promise<ExplainResponse> {
  try {
    const text = await chat(options, {
      messages: [
        { role: 'system', content: EXPLAIN_SYSTEM },
        { role: 'user', content: JSON.stringify(planFacts(plan)) },
      ],
      temperature: EXPLAIN_TEMPERATURE,
    });
    return explanationFromReply(text, plan, name);
  } catch {
    return templateResponse(plan);
  }
}

/** A local vision model served by Ollama (https://ollama.com), called with plain fetch. */
export function createOllamaProvider(options: OllamaOptions): AiProvider {
  const name = `a local model (${options.model})`;
  return {
    name,
    scanShade: (image, segmentId, time) => scanShade(options, name, { image, segmentId, time }),
    explainPlan: (plan) => explainPlan(options, name, plan),
  };
}
