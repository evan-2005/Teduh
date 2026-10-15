import { serve } from '@hono/node-server';
import { Hono } from 'hono';

// STUB (Teammate B owns this file): add POST /api/shade-scan and POST /api/explain.
const PORT = 8787;

export const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true }));

serve({ fetch: app.fetch, port: PORT });
