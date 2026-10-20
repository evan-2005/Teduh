import { z } from 'zod';

/** Shared by the browser client and the Hono server. */

const MAX_LIST_ITEMS = 10;
const MAX_LABEL_CHARS = 80;
const MAX_NOTES_CHARS = 400;
const MAX_SOURCE_CHARS = 80;

/** Which model wrote a non-mock reply, e.g. "Claude" or "a local model (gemma3:4b)". */
const sourceSchema = z.string().max(MAX_SOURCE_CHARS).optional();

/** What the vision model is asked to return (the server adds segmentId and isMock). */
export const shadeScanBodySchema = z.object({
  shadeFraction: z.number().min(0).max(1),
  shadeSources: z.array(z.string().max(MAX_LABEL_CHARS)).max(MAX_LIST_ITEMS),
  obstacles: z.array(z.string().max(MAX_LABEL_CHARS)).max(MAX_LIST_ITEMS),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string().max(MAX_NOTES_CHARS),
});

export const shadeScanResultSchema = shadeScanBodySchema.extend({
  segmentId: z.string().min(1),
  isMock: z.boolean(),
  source: sourceSchema,
});

export const explainResponseSchema = z.object({
  summary: z.string().min(1),
  isMock: z.boolean(),
  source: sourceSchema,
});

/** GET /api/status: which AI the server will use, and if it cannot, what to do about it. */
export const aiStatusSchema = z.object({
  mode: z.enum(['claude', 'ollama', 'mock']),
  ready: z.boolean(),
  model: z.string().max(MAX_SOURCE_CHARS).optional(),
  problem: z.string().max(MAX_NOTES_CHARS).optional(),
  fix: z.string().max(MAX_NOTES_CHARS).optional(),
});

const routeSchema = z.object({
  journeyId: z.string(),
  segmentIds: z.array(z.string()),
  lengthM: z.number(),
  walkMin: z.number(),
  sunMin: z.number(),
  longestExposedM: z.number(),
});

/** A PlanResult plus optional display names and the unweighted headline figure. */
export const explainRequestSchema = z.object({
  interventionIds: z.array(z.string()).min(1),
  installCost: z.number(),
  annualMaintenance: z.number(),
  sunMinutesAvoidedPerDay: z.number(),
  journeys: z.array(z.object({ journeyId: z.string(), before: routeSchema, after: routeSchema })),
  journeysImproved: z.array(z.string()),
  contributions: z.record(z.string(), z.number()),
  interventionNames: z.record(z.string(), z.string()).optional(),
  pedestrianSunMinutesAvoided: z.number().optional(),
});

export type ShadeScanBody = z.infer<typeof shadeScanBodySchema>;
export type ExplainRequest = z.infer<typeof explainRequestSchema>;
export type ExplainResponse = z.infer<typeof explainResponseSchema>;
export type AiStatus = z.infer<typeof aiStatusSchema>;
