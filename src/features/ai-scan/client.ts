import type { ZodType } from 'zod';
import type { ShadeScanResult, TimeSlot } from '../../types';
import {
  aiStatusSchema,
  explainResponseSchema,
  settingsSuggestionSchema,
  shadeScanResultSchema,
  type AiStatus,
  type ExplainRequest,
  type ExplainResponse,
  type SettingsSuggestion,
  type SuggestRequest,
} from './schemas';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class AiClientError extends Error {}

const MESSAGES = {
  network:
    'Could not reach the AI service. Is the API server running? Start it in a second terminal with npm run dev:server. You can still set the shade by hand.',
  server: 'The AI service had a problem. Try again, or set the shade by hand.',
  tooMany: 'Too many requests. Wait a minute and try again.',
  invalid: 'The AI service sent a reply the app could not read.',
} as const;

const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR = 500;

/**
 * Our server always answers in JSON. A 5xx without JSON comes from the dev or preview proxy,
 * which means the API server is not running.
 */
const isProxyFailure = (response: Response): boolean =>
  response.status >= HTTP_SERVER_ERROR && !(response.headers.get('content-type') ?? '').includes('json');

async function errorMessage(response: Response): Promise<string> {
  if (response.status === HTTP_TOO_MANY) return MESSAGES.tooMany;
  if (isProxyFailure(response)) return MESSAGES.network;
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

/** The server's AI status, or `unreachable` when the API server itself is not running. */
export type StatusResult = AiStatus | { mode: 'unreachable' };

export async function requestStatus(fetchImpl: FetchLike = fetch): Promise<StatusResult> {
  try {
    const response = await fetchImpl('/api/status');
    const parsed = aiStatusSchema.safeParse(await response.json().catch(() => null));
    return response.ok && parsed.success ? parsed.data : { mode: 'unreachable' };
  } catch {
    return { mode: 'unreachable' };
  }
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

export function requestSuggestion(req: SuggestRequest, fetchImpl: FetchLike = fetch): Promise<SettingsSuggestion> {
  return send(
    '/api/suggest-settings',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) },
    settingsSuggestionSchema,
    fetchImpl,
  );
}
