/** Small vision models run much faster on smaller photos, so shrink them before upload. */
export const MAX_UPLOAD_EDGE_PX = 1024;
const JPEG_QUALITY = 0.85;

/** The new size with the long side at `maxEdge`, or null when no shrinking is needed. */
export function scaledSize(
  width: number,
  height: number,
  maxEdge: number = MAX_UPLOAD_EDGE_PX,
): { width: number; height: number } | null {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return null;
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const toJpegBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));

/** Re-encode a large photo as a smaller JPEG. Returns the original file if anything fails. */
export async function downscalePhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = scaledSize(bitmap.width, bitmap.height);
    if (!size) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // JPEG has no alpha: transparent pixels would turn black and read as shade.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await toJpegBlob(canvas);
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
