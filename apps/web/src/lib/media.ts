import type { MediaRef } from '@vogn/types';

interface TransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'limit' | 'thumb';
  gravity?: 'auto' | 'face' | 'center';
}

/**
 * Builds an optimised Cloudinary delivery URL (auto format/quality + resizing). Non-Cloudinary URLs are
 * returned unchanged.
 */
export function mediaUrl(ref: Pick<MediaRef, 'url' | 'kind'> | string, options: TransformOptions = {}): string {
  const url = typeof ref === 'string' ? ref : ref.url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const parts = ['f_auto', 'q_auto'];
  if (options.crop) parts.push(`c_${options.crop}`);
  if (options.gravity) parts.push(`g_${options.gravity}`);
  else if (options.crop === 'fill' || options.crop === 'thumb') parts.push('g_auto');
  if (options.width) parts.push(`w_${Math.round(options.width)}`);
  if (options.height) parts.push(`h_${Math.round(options.height)}`);
  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

export function srcSet(ref: Pick<MediaRef, 'url' | 'kind'>, widths: number[], crop: TransformOptions['crop'] = 'limit'): string {
  return widths.map((w) => `${mediaUrl(ref, { width: w, crop })} ${w}w`).join(', ');
}
