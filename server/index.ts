import { serve } from '@hono/node-server';
import { createApp } from './app';
import { describeMode, selectProvider } from './provider';
import { aiStatus } from './status';

const PORT = 8787;

// Load .env if present. Keys and model settings stay on the server and are never logged.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: the server runs in mock mode.
}

const app = createApp({
  getProvider: () => selectProvider(process.env),
  getStatus: () => aiStatus(process.env),
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.error(`Teduh API listening on http://localhost:${PORT} in ${describeMode(process.env)}`);
});
