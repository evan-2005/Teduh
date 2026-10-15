import type { ZodType } from 'zod';
import type { ShadeScanResult, TimeSlot } from '../../types';
import {
  explainResponseSchema,
  shadeScanResultSchema,
  type ExplainRequest,
  type ExplainResponse,
} from './schemas';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class AiClientError extends Error {}

const MESSAGES = {
  network: 'Could not reach the AI service. Is the API server running? You can still set the shade by hand.',
  server: 'The AI service had a problem. Try again, or set the shade by hand.',
  tooMany: 'Too many requests. Wait a minute and try again.',
  invalid: 'The AI service sent a reply the app could not read.',
} as const;

const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR = 500;

async function errorMessage(response: Response): Promise<string> {
  if (response.status === HTTP_TOO_MANY) return MESSAGES.tooMany;
  if (response.status >= HTTP_SERVER_ERROR) return MESSAGES.server;
  // 4xx replies carry a short, user-facing message from our own server.
  const body: unknown = await response.json().catch(() => null);
  const text = (body as { error?: unknown } | null)?.error;
  return typeof text === 'string' ? text : MESSAGES.server;
}

async function send<T>(
  path: string,
  init: RequestInit,
  schema: ZodType<T>,
  fetchImpl: FetchLike,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(path, init);
  } catch {
    throw new AiClientError(MESSAGES.network);
  }
  if (!response.ok) throw new AiClientError(await errorMessage(response));
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new AiClientError(MESSAGES.invalid);
  return parsed.data;
}

export interface ScanRequest {
  image: File;
  segmentId: string;
  time: TimeSlot;
}

export function requestShadeScan(
  { image, segmentId, time }: ScanRequest,
  fetchImpl: FetchLike = fetch,
): Promise<ShadeScanResult> {
  const form = new FormData();
  form.set('image', image);
  form.set('segmentId', segmentId);
  form.set('time', time);
  return send('/api/shade-scan', { method: 'POST', body: form }, shadeScanResultSchema, fetchImpl);
}

export function requestExplanation(
  plan: ExplainRequest,
  fetchImpl: FetchLike = fetch,
): Promise<ExplainResponse> {
  return send(
    '/api/explain',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan) },
    explainResponseSchema,
    fetchImpl,
  );
}
