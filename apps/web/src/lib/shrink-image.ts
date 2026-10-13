import { MEDIA_LIMITS } from '@vogn/validation';

/** Private test storage keeps at most 1920 px; the extra headroom serves Cloudinary galleries. */
const MAX_EDGE = 2560;
/** [scale, quality] tried in order: almost every photo fits on the first, the rest trade quality before size. */
const ATTEMPTS = [[1, 0.85], [1, 0.72], [0.75, 0.72], [0.55, 0.7], [0.4, 0.7]] as const;
/** GIFs stay untouched because re-encoding would drop their animation. */
const SHRINKABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'];

function encode(bitmap: ImageBitmap, width: number, height: number, type: string, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  if (type === 'image/jpeg') {
    // JPEG has no transparency; keep transparent areas white rather than black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Re-encodes photos too large to upload, and HEIC (which the server cannot read), as WebP — or JPEG where the
 * browser cannot write WebP. Files that already fit, GIFs and anything the browser cannot decode are returned as-is.
 */
export async function shrinkImage(file: File, maxBytes: number = MEDIA_LIMITS.testImageBytes): Promise<File> {
  if (!SHRINKABLE.includes(file.type) || (file.size <= maxBytes && file.type !== 'image/heic') || typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  try {
    const fit = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    let type = 'image/webp';
    for (const [scale, quality] of ATTEMPTS) {
      const width = Math.max(1, Math.round(bitmap.width * fit * scale));
      const height = Math.max(1, Math.round(bitmap.height * fit * scale));
      let blob = await encode(bitmap, width, height, type, quality);
      if (blob && blob.type !== type) {
        // Browsers that cannot write WebP return PNG instead, which is far larger than JPEG.
        type = 'image/jpeg';
        blob = await encode(bitmap, width, height, type, quality);
      }
      if (!blob) return file;
      if (blob.size <= maxBytes) {
        const name = `${file.name.replace(/\.[^.]*$/, '') || 'photo'}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
        return new File([blob], name, { type, lastModified: file.lastModified });
      }
    }
    return file;
  } finally {
    bitmap.close();
  }
}
