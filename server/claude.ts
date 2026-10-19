import Anthropic from '@anthropic-ai/sdk';
import type { ExplainRequest, ExplainResponse } from '../src/features/ai-scan/schemas';
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

export const MODEL = 'claude-sonnet-5-5';
const PROVIDER_NAME = 'Claude';

const SHADE_MAX_TOKENS = 500;
const EXPLAIN_MAX_TOKENS = 500;

/** The one call we need from the SDK, so tests can supply a fake. */
export interface ClaudeClient {
  createMessage: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
}

export function clientFromKey(apiKey: string | undefined): ClaudeClient | null {
  if (!apiKey) return null;
  const sdk = new Anthropic({ apiKey });
  return { createMessage: (params) => sdk.messages.create(params) };
}

const firstText = (message: Anthropic.Message): string =>
  message.content.find((block): block is Anthropic.TextBlock => block.type === 'text')?.text ?? '';

const reasonFrom = (error: unknown): string =>
  error instanceof Anthropic.APIError
    ? `API error ${error.status ?? 'unknown'}`
    : 'AI reply could not be used';

async function scanShade(
  client: ClaudeClient,
  image: ScanImage,
  segmentId: string,
  time: TimeSlot,
): Promise<ShadeScanResult> {
  try {
    const message = await client.createMessage({
      model: MODEL,
      max_tokens: SHADE_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
            },
            { type: 'text', text: shadePrompt(time) },
          ],
        },
      ],
    });
    return scanFromReply(firstText(message), segmentId, PROVIDER_NAME);
  } catch (error) {
    return mockShadeResult(segmentId, reasonFrom(error));
  }
}

async function explainPlan(client: ClaudeClient, plan: ExplainRequest): Promise<ExplainResponse> {
  try {
    const message = await client.createMessage({
      model: MODEL,
      max_tokens: EXPLAIN_MAX_TOKENS,
      system: EXPLAIN_SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(planFacts(plan)) }],
    });
    return explanationFromReply(firstText(message), plan, PROVIDER_NAME);
  } catch {
    return templateResponse(plan);
  }
}

export function createClaudeProvider(client: ClaudeClient): AiProvider {
  return {
    name: PROVIDER_NAME,
    scanShade: (image, segmentId, time) => scanShade(client, image, segmentId, time),
    explainPlan: (plan) => explainPlan(client, plan),
  };
}
