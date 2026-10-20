import {
  shadeScanBodySchema,
  type ExplainRequest,
  type ExplainResponse,
  type SettingsSuggestion,
  type SuggestRequest,
} from '../src/features/ai-scan/schemas';
import { ruleSuggestion } from '../src/lib/suggestSettings';
import type { ShadeScanResult, TimeSlot } from '../src/types';
import { planFacts, sunHours, templateSummary } from './prompts';

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ScanImage {
  base64: string;
  mediaType: ImageMediaType;
}

/** One AI backend (Claude, a local Ollama model, ...). Implementations never throw. */
export interface AiProvider {
  /** Shown in the UI next to non-mock results, e.g. "Claude" or "a local model (gemma3:4b)". */
  name: string;
  scanShade(image: ScanImage, segmentId: string, time: TimeSlot): Promise<ShadeScanResult>;
  explainPlan(plan: ExplainRequest): Promise<ExplainResponse>;
  /** Detour limit and destination weights from a description of who lives here. */
  suggestSettings(req: SuggestRequest): Promise<SettingsSuggestion>;
}

const FALLBACK_SHADE = 0.5;
const NO_PROVIDER_REASON = 'no AI configured on the server: set ANTHROPIC_API_KEY or AI_PROVIDER=ollama';
const NOTES_REMOVED = 'The model commented on more than shade, so its notes are hidden.';

/** Words a model reply must not use: the app makes no temperature, health or safety claims. */
export const BANNED_CLAIM_WORDS: readonly string[] = [
  'temperature',
  'temperatures',
  'cool',
  'cooler',
  'cooling',
  'health',
  'healthy',
  'healthier',
  'safe',
  'safer',
  'safety',
  'unsafe',
];

const BANNED_CLAIM_PATTERN = new RegExp(`\\b(${BANNED_CLAIM_WORDS.join('|')})\\b`, 'i');

export const hasBannedClaim = (text: string): boolean => BANNED_CLAIM_PATTERN.test(text);

/** Placeholder result used when there is no provider, the call fails, or the reply is invalid. */
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

/** Models sometimes wrap JSON in fences; pull out the outermost object. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
}

/** Validate a model's scan reply. Throws when it is not usable. */
export function scanFromReply(text: string, segmentId: string, source: string): ShadeScanResult {
  const body = shadeScanBodySchema.parse(extractJson(text));
  const notes = hasBannedClaim(body.notes) ? NOTES_REMOVED : body.notes;
  return { ...body, notes, segmentId, isMock: false, source };
}

export const templateResponse = (plan: ExplainRequest): ExplainResponse => ({
  summary: templateSummary(plan),
  isMock: true,
});

/** Digit runs with optional thousands commas and decimals: "18,000", "18000", "47.0". */
const FIGURE_PATTERN = /\d[\d,]*(?:\.\d+)?/g;

const figuresIn = (text: string): number[] =>
  (text.match(FIGURE_PATTERN) ?? []).map((figure) => Number(figure.replace(/,/g, '')));

/** Every number the explainer may state: the plan facts and numbers inside intervention names. */
function allowedFigures(plan: ExplainRequest): Set<number> {
  const f = planFacts(plan);
  const names = [...f.interventions, f.biggestContributor?.name ?? ''];
  return new Set([
    f.installCostMyr,
    f.annualUpkeepMyr,
    f.pedestrianSunMinutesAvoidedPerDay,
    Number(sunHours(f.pedestrianSunMinutesAvoidedPerDay)),
    f.journeysImproved,
    f.journeysTotal,
    f.interventions.length,
    ...(f.biggestContributor ? [f.biggestContributor.minutesPerDay] : []),
    ...names.flatMap(figuresIn),
  ]);
}

/** Numbers check: true when the text states a figure that is not one of the plan facts. */
export function hasUnknownFigure(text: string, plan: ExplainRequest): boolean {
  const allowed = allowedFigures(plan);
  return figuresIn(text).some((figure) => !allowed.has(figure));
}

/** Use the model's summary unless it is empty, makes a banned claim or invents a figure. */
export function explanationFromReply(
  text: string,
  plan: ExplainRequest,
  source: string,
): ExplainResponse {
  const summary = text.trim();
  if (!summary || hasBannedClaim(summary) || hasUnknownFigure(summary, plan)) {
    return templateResponse(plan);
  }
  return { summary, isMock: false, source };
}

export function scanWith(
  provider: AiProvider | null,
  image: ScanImage,
  segmentId: string,
  time: TimeSlot,
): Promise<ShadeScanResult> {
  if (!provider) return Promise.resolve(mockShadeResult(segmentId, NO_PROVIDER_REASON));
  return provider.scanShade(image, segmentId, time);
}

export function suggestWith(provider: AiProvider | null, req: SuggestRequest): Promise<SettingsSuggestion> {
  return provider ? provider.suggestSettings(req) : Promise.resolve(ruleSuggestion(req));
}

export function explainWith(
  provider: AiProvider | null,
  plan: ExplainRequest,
): Promise<ExplainResponse> {
  return provider ? provider.explainPlan(plan) : Promise.resolve(templateResponse(plan));
}
