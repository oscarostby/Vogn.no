// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shrinkImage } from './shrink-image';

const LIMIT = 2 * 1024 * 1024;
const photo = (size: number, type = 'image/jpeg', name = 'IMG_0042.JPG') => new File([new Uint8Array(size)], name, { type });

/** Fake browser: decodes every image to `decoded` and writes `bytesPerPixel × quality` per pixel. */
let decoded = { width: 6000, height: 4000 };
let bytesPerPixel = 0.5;
let writesWebp = true;
let encodes: { width: number; height: number; type: string; quality: number }[] = [];
const context = { fillStyle: '', imageSmoothingQuality: 'low', fillRect: vi.fn(), drawImage: vi.fn() };
const close = vi.fn();

beforeEach(() => {
  decoded = { width: 6000, height: 4000 };
  bytesPerPixel = 0.5;
  writesWebp = true;
  encodes = [];
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ ...decoded, close })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, requested = 'image/png', quality = 0.92) {
    const type = requested === 'image/webp' && !writesWebp ? 'image/png' : requested;
    encodes.push({ width: this.width, height: this.height, type, quality });
    callback(new Blob([new Uint8Array(Math.round(this.width * this.height * bytesPerPixel * quality))], { type }));
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('shrinkImage', () => {
  it('leaves photos that already fit untouched', async () => {
    const small = photo(LIMIT);
    expect(await shrinkImage(small)).toBe(small);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it('scales a large photo to 2560 px WebP under the limit', async () => {
    const result = await shrinkImage(photo(6 * 1024 * 1024));
    expect(encodes).toEqual([{ width: 2560, height: 1707, type: 'image/webp', quality: 0.85 }]);
    expect(result).toMatchObject({ name: 'IMG_0042.webp', type: 'image/webp' });
    expect(result.size).toBeLessThanOrEqual(LIMIT);
    expect(close).toHaveBeenCalledOnce();
  });

  it('lowers quality, then size, until the photo fits', async () => {
    bytesPerPixel = 1.5;
    const result = await shrinkImage(photo(9 * 1024 * 1024));
    expect(encodes.map(({ width, quality }) => [width, quality])).toEqual([[2560, 0.85], [2560, 0.72], [1920, 0.72], [1408, 0.7]]);
    expect(result.size).toBeLessThanOrEqual(LIMIT);
  });

  it('falls back to JPEG on a white background where the browser cannot write WebP', async () => {
    writesWebp = false;
    const result = await shrinkImage(photo(5 * 1024 * 1024, 'image/png', 'screenshot.png'));
    expect(encodes.map(({ type }) => type)).toEqual(['image/png', 'image/jpeg']);
    expect(result).toMatchObject({ name: 'screenshot.jpg', type: 'image/jpeg' });
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 2560, 1707);
  });

  it('converts HEIC the browser can decode, even when small', async () => {
    decoded = { width: 4032, height: 3024 };
    const result = await shrinkImage(photo(900_000, 'image/heic', 'IMG_0001.HEIC'));
    expect(result).toMatchObject({ name: 'IMG_0001.webp', type: 'image/webp' });
  });

  it('keeps GIFs, undecodable images and photos that cannot be made small enough', async () => {
    const gif = photo(3 * 1024 * 1024, 'image/gif', 'loop.gif');
    expect(await shrinkImage(gif)).toBe(gif);
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('unsupported'));
    const heic = photo(3 * 1024 * 1024, 'image/heic', 'IMG.HEIC');
    expect(await shrinkImage(heic)).toBe(heic);
    const noisy = photo(8 * 1024 * 1024);
    expect(await shrinkImage(noisy, 100_000)).toBe(noisy);
    expect(encodes).toHaveLength(5);
  });
});
