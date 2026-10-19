import { describe, expect, test } from 'vitest';
import { MAX_UPLOAD_EDGE_PX, scaledSize } from './downscale';

describe('scaledSize', () => {
  test('shrinks the long side to the limit and keeps the aspect ratio', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: MAX_UPLOAD_EDGE_PX, height: 768 });
    expect(scaledSize(3000, 4000)).toEqual({ width: 768, height: MAX_UPLOAD_EDGE_PX });
  });

  test('returns null when the photo is already small enough', () => {
    expect(scaledSize(800, 600)).toBeNull();
    expect(scaledSize(MAX_UPLOAD_EDGE_PX, MAX_UPLOAD_EDGE_PX)).toBeNull();
  });

  test('never returns a zero-pixel side', () => {
    expect(scaledSize(10000, 1)).toEqual({ width: MAX_UPLOAD_EDGE_PX, height: 1 });
  });
});
