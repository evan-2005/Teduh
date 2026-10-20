import type { StatusResult } from './client';

export type StatusTone = 'ok' | 'warn' | 'error';

export interface StatusText {
  tone: StatusTone;
  title: string;
  detail?: string;
  fix?: string;
}

/** What the AI status card says, in words a first-time teammate can act on. */
export function describeStatus(status: StatusResult): StatusText {
  if (status.mode === 'unreachable') {
    return {
      tone: 'error',
      title: 'The AI server is not running.',
      detail: 'The AI scan and the plan explainer need it. Everything else works without it.',
      fix: 'Open a second terminal in the project folder and run: npm run dev:server',
    };
  }
  if (status.ready) {
    const who = status.mode === 'claude' ? 'Claude' : `a local model (${status.model ?? 'unknown'})`;
    return { tone: 'ok', title: `AI ready: ${who}.` };
  }
  return {
    tone: status.mode === 'mock' ? 'warn' : 'error',
    title: status.problem ?? 'The AI is not ready.',
    ...(status.mode === 'mock' ? { detail: 'You can still try the scan: results are labelled MOCK and you set the shade by hand.' } : {}),
    ...(status.fix ? { fix: status.fix } : {}),
  };
}
