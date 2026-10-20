import { z } from 'zod';
import type { SettingsSuggestion, SuggestRequest } from '../src/features/ai-scan/schemas';
import { MAX_DETOUR } from '../src/config';
import { MAX_WEIGHT } from '../src/lib/priority';
import { cleanSuggestion, ruleSuggestion } from '../src/lib/suggestSettings';
import { extractJson } from './ai';

/** What a model must reply with; the server cleans it before the browser sees it. */
export const rawSuggestionSchema = z.object({
  detourLimit: z.number(),
  detourReason: z.string(),
  weights: z.array(z.object({ id: z.string(), weight: z.number(), reason: z.string() })),
  summary: z.string(),
});

export const SUGGEST_SYSTEM = `You help a township manager tune a shade-planning tool.
Walks to each destination can be weighted from 0 (ignored) to ${MAX_WEIGHT} (counts ${MAX_WEIGHT} times); 1 is neutral.
The detour limit, from 0 to ${MAX_DETOUR}, is how much longer than the shortest walk a shadier route may be (0.25 = 25%). Older people and people with limited mobility tolerate less detour; students and commuters with time tolerate more.
Base every suggestion only on the manager's description of who lives and walks here and on the destination list you are given. Do not invent statistics or demographics. If the description says nothing about a destination, keep it at 1.
Trips per day are already counted in the score, so never raise a weight because a place is busy: weights say whose walks matter more, not how many there are.
When the description names a group, raise the places that group walks to: students to schools and colleges (kind "school"); older residents to clinics, places of worship and parks; families with children to schools and parks; shoppers to malls and shops.
Reply with JSON only, no prose and no code fences:
{"detourLimit": <number>, "detourReason": "<under 20 words>", "weights": [{"id": "<destination id>", "weight": <number>, "reason": "<under 20 words>"}], "summary": "<one or two sentences>"}
Do not claim any temperature, health or safety benefit.`;

/** The facts the model sees: the description, and the places with their modelled trips per day. */
export const suggestFacts = (req: SuggestRequest): string =>
  JSON.stringify({
    area: req.area,
    description: req.description || '(no description given)',
    currentDetourLimit: req.currentDetourLimit,
    destinations: req.destinations,
    startPoints: req.startPoints,
  });

/** The rules, with a note on why the model's answer was not used. */
export function fallbackSuggestion(req: SuggestRequest, reason: string): SettingsSuggestion {
  const rules = ruleSuggestion(req);
  return { ...rules, summary: `The AI suggestion could not be used (${reason}), so these come from simple rules. ${rules.summary}` };
}

/** Use the model's reply if it parses; otherwise the labelled rules. */
export function suggestionFromReply(text: string, req: SuggestRequest, source: string): SettingsSuggestion {
  try {
    return cleanSuggestion(rawSuggestionSchema.parse(extractJson(text)), req, source);
  } catch {
    return fallbackSuggestion(req, 'the reply was not in the expected format');
  }
}
