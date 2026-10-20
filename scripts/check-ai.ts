/**
 * Checks everything the AI scan needs on this laptop and says how to fix what is missing.
 *
 *   npm run check:ai
 */
import { existsSync } from 'node:fs';
import { aiStatus } from '../server/status';

const API_HEALTH = 'http://localhost:8787/api/health';
const MIN_NODE_MAJOR = 20;
const TIMEOUT_MS = 3000;

let failures = 0;
function report(ok: boolean, label: string, fix?: string): void {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? 'OK  ' : 'FIX '} ${label}\n`);
  if (!ok && fix) process.stdout.write(`     → ${fix}\n`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
report(nodeMajor >= MIN_NODE_MAJOR, `Node ${process.versions.node}`, `Install Node ${MIN_NODE_MAJOR} or newer from https://nodejs.org`);

const hasEnv = existsSync('.env');
report(hasEnv, '.env file exists', 'Copy the template: Windows "copy .env.example .env", Mac/Linux "cp .env.example .env"');
if (hasEnv) process.loadEnvFile('.env');

report(
  process.env.VITE_ENABLE_AI === 'true',
  'VITE_ENABLE_AI=true (shows the AI scan page)',
  'Set VITE_ENABLE_AI=true in .env, then restart npm run dev (or run npm run build again before npm run preview)',
);

const status = await aiStatus(process.env);
const who = status.mode === 'claude' ? 'Claude' : status.mode === 'ollama' ? `local model ${status.model}` : 'no AI (MOCK results)';
report(status.ready, `AI provider: ${who}${status.problem ? ` (${status.problem})` : ''}`, status.fix);

const serverUp = await fetch(API_HEALTH, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  .then((r) => r.ok)
  .catch(() => false);
report(serverUp, 'AI server running on port 8787', 'In a second terminal in this folder, run: npm run dev:server');

process.stdout.write(failures === 0 ? '\nAll good: open the app and use 4 AI scan.\n' : `\n${failures} thing(s) to fix, then run npm run check:ai again.\n`);
process.exitCode = failures === 0 ? 0 : 1;
