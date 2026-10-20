/**
 * Suggested planning settings (detour limit and destination weights) from a description of who
 * lives and walks in the area. Shared by the server (to clean AI replies, and as its fallback)
 * and the browser (when the AI server is not running).
 */
import { DETOUR_STEP, MAX_DETOUR } from '../config';
import type { SettingsSuggestion, SuggestRequest } from '../features/ai-scan/schemas';
import { DEFAULT_WEIGHT, MAX_WEIGHT, MIN_WEIGHT, WEIGHT_STEP } from './priority';

const RULES_SOURCE = 'rules (no AI model)';
const NO_CHANGE = 'No change: nothing in the description points to it.';
/** The app makes no temperature, health or safety claims, in suggestions either. */
const CLAIM_WORDS = /\b(temperatures?|cool(er|ing)?|health(y|ier)?|safe(r|ty)?|unsafe)\b/i;

interface Rule {
  pattern: RegExp;
  group: string;
  kinds: Readonly<Record<string, number>>;
  detour?: number;
  why: string;
}

/** Plain, inspectable rules: who the description mentions → which walks matter more. */
const RULES: readonly Rule[] = [
  { pattern: /\b(elderly|older|senior|retire|aged|pensioner)/i, group: 'older residents', kinds: { clinic: 2, worship: 1.5, park: 1.25 }, detour: 0.15, why: 'older walkers take shorter detours' },
  { pattern: /\b(wheelchair|disab|mobility|pram|stroller)/i, group: 'people with limited mobility', kinds: { clinic: 1.5, mall: 1.25 }, detour: 0.1, why: 'long detours are hard with limited mobility' },
  { pattern: /\b(student|universit|college|undergrad)/i, group: 'students', kinds: { school: 2 }, detour: 0.3, why: 'students accept longer shaded detours' },
  { pattern: /\b(famil|child|kids?\b|parent|school)/i, group: 'families with children', kinds: { school: 1.5, park: 1.5 }, why: '' },
  { pattern: /\b(commut|worker|office|shift)/i, group: 'commuters', kinds: { mall: 1.25, shops: 1.25 }, detour: 0.2, why: 'commuters want direct routes' },
  { pattern: /\b(mosque|surau|church|temple|worship|prayer)/i, group: 'people walking to prayer', kinds: { worship: 1.5 }, why: '' },
  { pattern: /\b(shopper|shopping|market|retail)/i, group: 'shoppers', kinds: { mall: 1.5, shops: 1.5 }, why: '' },
];

const snap = (value: number, step: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value / step) * step));
const snapWeight = (w: number): number => snap(w, WEIGHT_STEP, MIN_WEIGHT, MAX_WEIGHT);
const snapDetour = (d: number): number => Number(snap(d, DETOUR_STEP, 0, MAX_DETOUR).toFixed(2));
const percent = (d: number): string => `${Math.round(d * 100)}%`;

/** Deterministic suggestion from the description's keywords. Labelled as rules, not AI. */
export function ruleSuggestion(req: SuggestRequest): SettingsSuggestion {
  const matched = RULES.filter((r) => r.pattern.test(req.description));
  const weights = req.destinations.map((d) => {
    const hits = matched.filter((r) => (r.kinds[d.kind] ?? DEFAULT_WEIGHT) !== DEFAULT_WEIGHT);
    if (hits.length === 0) return { id: d.id, weight: DEFAULT_WEIGHT, reason: NO_CHANGE };
    const weight = snapWeight(Math.max(...hits.map((r) => r.kinds[d.kind] ?? DEFAULT_WEIGHT)));
    return { id: d.id, weight, reason: `You mentioned ${hits.map((r) => r.group).join(' and ')}: walks here count ×${weight}.` };
  });
  const detourRules = matched.filter((r) => r.detour !== undefined);
  const shortest = detourRules.sort((a, b) => (a.detour ?? 0) - (b.detour ?? 0))[0];
  const detourLimit = shortest?.detour ?? snapDetour(req.currentDetourLimit);
  return {
    detourLimit,
    detourReason: shortest ? `${percent(detourLimit)}: ${shortest.why}.` : 'Unchanged: the description does not suggest a different detour.',
    weights,
    summary:
      matched.length === 0
        ? 'Describe who lives and walks here (for example "many older residents" or "a university nearby") to get suggestions. With no description everything stays as it is.'
        : `Based on keywords in your description (${matched.map((r) => r.group).join(', ')}). These are simple rules, not data about the area: check them before applying.`,
    isMock: true,
    source: RULES_SOURCE,
  };
}

export interface RawSuggestion {
  detourLimit: number;
  detourReason: string;
  weights: readonly { id: string; weight: number; reason: string }[];
  summary: string;
}

const clean = (text: string, fallback: string): string => (text.trim() && !CLAIM_WORDS.test(text) ? text.trim() : fallback);

/** Fit a model's suggestion to the app: known places only, slider steps and ranges, no claims. */
export function cleanSuggestion(raw: RawSuggestion, req: SuggestRequest, source: string): SettingsSuggestion {
  const byId = new Map(raw.weights.map((w) => [w.id, w]));
  return {
    detourLimit: snapDetour(raw.detourLimit),
    detourReason: clean(raw.detourReason, 'Suggested from your description.'),
    weights: req.destinations.map((d) => {
      const w = byId.get(d.id);
      return w
        ? { id: d.id, weight: snapWeight(w.weight), reason: clean(w.reason, 'Weighted from your description.') }
        : { id: d.id, weight: DEFAULT_WEIGHT, reason: 'No change suggested.' };
    }),
    summary: clean(raw.summary, 'Suggested from your description and the places people walk to here. Check before applying.'),
    isMock: false,
    source,
  };
}
