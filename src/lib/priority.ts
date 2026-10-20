/** How much a destination's walks count when ranking plans: ×0 ignores them, ×5 counts them five times. */
export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 5;
export const WEIGHT_STEP = 0.25;
export const DEFAULT_WEIGHT = 1;

/** A typed weight ("2", "1.5", "×3") snapped to the slider's steps and range, or null if it is not a number. */
export function parseWeight(text: string): number | null {
  const cleaned = text.trim().replace(/^[×xX]\s*/, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  const snapped = Math.round(value / WEIGHT_STEP) * WEIGHT_STEP;
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, snapped));
}
