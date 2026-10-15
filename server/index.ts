import { serve } from '@hono/node-server';
import { createApp } from './app';
import { clientFromKey } from './claude';

const PORT = 8787;

// Load .env if present. The key stays on the server and is never logged.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: the server runs in mock mode.
}

const app = createApp({ getClient: () => clientFromKey(process.env['ANTHROPIC_API_KEY']) });

serve({ fetch: app.fetch, port: PORT }, () => {
  const mode = process.env['ANTHROPIC_API_KEY'] ? 'Claude' : 'mock (no ANTHROPIC_API_KEY)';
  console.error(`Teduh API listening on http://localhost:${PORT} in ${mode} mode`);
});
