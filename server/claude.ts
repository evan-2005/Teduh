import Anthropic from '@anthropic-ai/sdk';
import {
  shadeScanBodySchema,
  type ExplainRequest,
  type ExplainResponse,
} from '../src/features/ai-scan/schemas';
import type { ShadeScanResult } from '../src/types';

export const MODEL = 'claude-sonnet-5-5';

const SHADE_MAX_TOKENS = 500;
const EXPLAIN_MAX_TOKENS = 500;
const FALLBACK_SHADE = 0.5;

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

/** The one call we need from the SDK, so tests can supply a fake. */
export interface ClaudeClient {
  createMessage: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;
}

export function clientFromKey(apiKey: string | undefined): ClaudeClient | null {
  if (!apiKey) return null;
  const sdk = new Anthropic({ apiKey });
  return { createMessage: (params) => sdk.messages.create(params) };
}

const SHADE_PROMPT = `You are helping survey a footpath. Look at this photo and estimate how shaded the walking surface is.
Reply with JSON only, no prose and no code fences, in exactly this shape:
{"shadeFraction": <0 to 1, fraction of the walking surface in shade>, "shadeSources": [<short labels such as "tree canopy", "shop awning", "building">], "obstacles": [<anything blocking the path, e.g. "parked motorcycle">], "confidence": "low" | "medium" | "high", "notes": "<one or two sentences>"}
Shade only. Do not comment on temperature, comfort or safety. If the photo is unclear, use low confidence.`;

const EXPLAIN_SYSTEM = `You write short summaries of shade-planning results for township managers.
Use only the numbers in the JSON you are given. Never invent or estimate other figures.
Write 4 to 6 plain sentences. State the main assumptions: illustrative survey snapshots, estimated costs, shade is not the same as comfort.
Do not claim any temperature reduction, health benefit or safety benefit.`;

/** Placeholder result used when there is no key, the API fails, or the reply is invalid. */
export function mockShadeResult(segmentId: string, reason: string): ShadeScanResult {
  return {
    segmentId,
    shadeFraction: FALLBACK_SHADE,
    shadeSources: [],
    obstacles: [],
    confidence: 'low',
    notes: `MOCK result (${reason}). Set the shade by hand.`,
    isMock: true,
  };
}

const firstText = (message: Anthropic.Message): string =>
  message.content.find((block): block is Anthropic.TextBlock => block.type === 'text')?.text ?? '';

/** Models sometimes wrap JSON in fences; pull out the outermost object. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
}

export async function scanShade(
  client: ClaudeClient | null,
  image: { base64: string; mediaType: ImageMediaType },
  segmentId: string,
): Promise<ShadeScanResult> {
  if (!client) return mockShadeResult(segmentId, 'no ANTHROPIC_API_KEY on the server');
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
            { type: 'text', text: SHADE_PROMPT },
          ],
        },
      ],
    });
    const body = shadeScanBodySchema.parse(extractJson(firstText(message)));
    return { ...body, segmentId, isMock: false };
  } catch (error) {
    return mockShadeResult(segmentId, reasonFrom(error));
  }
}

const reasonFrom = (error: unknown): string =>
  error instanceof Anthropic.APIError
    ? `API error ${error.status ?? 'unknown'}`
    : 'AI reply could not be used';

interface Facts {
  interventions: string[];
  installCostMyr: number;
  annualUpkeepMyr: number;
  pedestrianSunMinutesAvoidedPerDay: number;
  journeysImproved: number;
  journeysTotal: number;
  biggestContributor: { name: string; minutesPerDay: number } | null;
}

/** The only numbers the explainer may use, derived from the plan. */
export function planFacts(plan: ExplainRequest): Facts {
  const nameOf = (id: string): string => plan.interventionNames?.[id] ?? id;
  const top = Object.entries(plan.contributions).sort((a, b) => b[1] - a[1])[0];
  return {
    interventions: plan.interventionIds.map(nameOf),
    installCostMyr: Math.round(plan.installCost),
    annualUpkeepMyr: Math.round(plan.annualMaintenance),
    pedestrianSunMinutesAvoidedPerDay: Math.round(
      plan.pedestrianSunMinutesAvoided ?? plan.sunMinutesAvoidedPerDay,
    ),
    journeysImproved: plan.journeysImproved.length,
    journeysTotal: plan.journeys.length,
    biggestContributor: top ? { name: nameOf(top[0]), minutesPerDay: Math.round(top[1]) } : null,
  };
}

/** Deterministic summary built only from the plan's numbers. */
export function templateSummary(plan: ExplainRequest): string {
  const f = planFacts(plan);
  const hours = (f.pedestrianSunMinutesAvoidedPerDay / 60).toFixed(1);
  const lead = f.biggestContributor
    ? ` The largest single contribution comes from ${f.biggestContributor.name}.`
    : '';
  return (
    `This plan installs ${f.interventions.join(', ')} for about RM ${f.installCostMyr.toLocaleString('en-US')}, ` +
    `with RM ${f.annualUpkeepMyr.toLocaleString('en-US')} a year in upkeep. ` +
    `It avoids roughly ${hours} pedestrian-hours in direct sun per day and improves ` +
    `${f.journeysImproved} of ${f.journeysTotal} modelled journeys.${lead} ` +
    'These figures come from illustrative shade snapshots and estimated costs, ' +
    'and shade is not the same as comfort or safety.'
  );
}

export async function explainPlan(
  client: ClaudeClient | null,
  plan: ExplainRequest,
): Promise<ExplainResponse> {
  const fallback: ExplainResponse = { summary: templateSummary(plan), isMock: true };
  if (!client) return fallback;
  try {
    const message = await client.createMessage({
      model: MODEL,
      max_tokens: EXPLAIN_MAX_TOKENS,
      system: EXPLAIN_SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(planFacts(plan)) }],
    });
    const summary = firstText(message).trim();
    return summary ? { summary, isMock: false } : fallback;
  } catch {
    return fallback;
  }
}
