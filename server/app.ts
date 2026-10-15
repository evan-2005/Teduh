import { Hono } from 'hono';
import { TIME_SLOTS } from '../src/config';
import { explainRequestSchema } from '../src/features/ai-scan/schemas';
import { explainPlan, scanShade, type ClaudeClient, type ImageMediaType } from './claude';
import { createRateLimiter } from './rateLimit';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_SEGMENT_ID_CHARS = 64;
const SEGMENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const ALLOWED_TYPES: readonly ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

export interface AppOptions {
  /** Called per request so tests can swap clients and the key is never held in the module. */
  getClient: () => ClaudeClient | null;
  allow?: (key: string) => boolean;
}

/** Check the real file signature, not just the declared type. */
export function sniffImageType(bytes: Uint8Array): ImageMediaType | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  const isRiff = startsWith(0x52, 0x49, 0x46, 0x46);
  const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return isRiff && isWebp ? 'image/webp' : null;
}

export function createApp(options: AppOptions): Hono {
  const allow = options.allow ?? createRateLimiter();
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/health') return next();
    const key = c.req.header('x-forwarded-for') ?? 'local';
    if (!allow(key)) return c.json({ error: 'Too many requests. Try again in a minute.' }, 429);
    return next();
  });

  app.post('/api/shade-scan', async (c) => {
    const form = await c.req.parseBody().catch(() => null);
    const image = form?.['image'];
    const segmentId = form?.['segmentId'];
    const time = form?.['time'];

    if (!(image instanceof File)) return c.json({ error: 'Attach a photo as "image".' }, 400);
    if (typeof segmentId !== 'string' || segmentId.length > MAX_SEGMENT_ID_CHARS || !SEGMENT_ID_PATTERN.test(segmentId)) {
      return c.json({ error: 'Invalid segmentId.' }, 400);
    }
    if (typeof time !== 'string' || !(TIME_SLOTS as readonly string[]).includes(time)) {
      return c.json({ error: 'Invalid time slot.' }, 400);
    }
    if (image.size > MAX_IMAGE_BYTES) return c.json({ error: 'Photo is larger than 5 MB.' }, 413);
    if (!ALLOWED_TYPES.includes(image.type as ImageMediaType)) {
      return c.json({ error: 'Photo must be JPEG, PNG or WebP.' }, 400);
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    const mediaType = sniffImageType(bytes);
    if (!mediaType) return c.json({ error: 'File is not a valid JPEG, PNG or WebP image.' }, 400);

    const base64 = Buffer.from(bytes).toString('base64');
    return c.json(await scanShade(options.getClient(), { base64, mediaType }, segmentId));
  });

  app.post('/api/explain', async (c) => {
    const parsed = explainRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Send a plan with at least one intervention.' }, 400);
    return c.json(await explainPlan(options.getClient(), parsed.data));
  });

  return app;
}
