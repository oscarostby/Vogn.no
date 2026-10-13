/**
 * Generates icons, favicons, OG fallback and Expo app icons from the master VOGN logos.
 * Run: node scripts/generate-brand-assets.mjs   (uses sharp from apps/web)
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'apps/web/package.json'));
const sharp = require('sharp');

const brandDir = path.join(root, 'apps/web/public/brand');
const appDir = path.join(root, 'apps/web/src/app');
const mobileAssets = path.join(root, 'apps/mobile/assets/images');
mkdirSync(mobileAssets, { recursive: true });

const WHITE = path.join(brandDir, 'vogn-logo-white.webp');
const BLACK = path.join(brandDir, 'vogn-logo-black.webp');
const INK = { r: 16, g: 17, b: 20, alpha: 1 };
const LIME = { r: 200, g: 255, b: 95, alpha: 1 };

/** The "V" mark occupies the upper part of the 1280×853 master; the wordmark sits below it. */
async function mark(src) {
  const cropped = await sharp(src).extract({ left: 0, top: 120, width: 1280, height: 445 }).png().toBuffer();
  return sharp(cropped).trim().png().toBuffer();
}

async function wordmark(src) {
  return sharp(src).trim().png().toBuffer();
}

/** Recolours a single-colour transparent logo. */
async function tint(buffer, { r, g, b }) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function squareIcon(markBuffer, size, { background, padding, radius }) {
  const inner = Math.round(size * (1 - padding * 2));
  const resized = await sharp(markBuffer).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer();
  const meta = await sharp(resized).metadata();
  const base = sharp({ create: { width: size, height: size, channels: 4, background } });
  const composed = await base
    .composite([{ input: resized, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png()
    .toBuffer();
  if (!radius) return composed;
  const r = Math.round(size * radius);
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
  return sharp(composed).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const whiteMark = await mark(WHITE);
const blackMark = await mark(BLACK);
const limeMark = await tint(whiteMark, LIME);

await sharp(whiteMark).toFile(path.join(brandDir, 'vogn-mark-white.png'));
await sharp(blackMark).toFile(path.join(brandDir, 'vogn-mark-black.png'));
await sharp(limeMark).toFile(path.join(brandDir, 'vogn-mark-lime.png'));
await sharp(await wordmark(WHITE)).toFile(path.join(brandDir, 'vogn-wordmark-white.png'));
await sharp(await wordmark(BLACK)).toFile(path.join(brandDir, 'vogn-wordmark-black.png'));

// Web app icons (Next.js file conventions + manifest icons)
await sharp(await squareIcon(limeMark, 512, { background: INK, padding: 0.2, radius: 0.22 })).toFile(path.join(appDir, 'icon.png'));
await sharp(await squareIcon(limeMark, 180, { background: INK, padding: 0.18, radius: 0 })).toFile(path.join(appDir, 'apple-icon.png'));
await sharp(await squareIcon(limeMark, 192, { background: INK, padding: 0.2, radius: 0.22 })).toFile(path.join(brandDir, 'icon-192.png'));
await sharp(await squareIcon(limeMark, 512, { background: INK, padding: 0.2, radius: 0 })).toFile(path.join(brandDir, 'icon-512-maskable.png'));

// Open Graph fallback (dynamic OG images are rendered by app/opengraph-image.tsx)
{
  const logo = await sharp(await wordmark(WHITE)).resize({ width: 520 }).toBuffer();
  const meta = await sharp(logo).metadata();
  const bar = await sharp({ create: { width: 1200, height: 8, channels: 4, background: LIME } }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: INK } })
    .composite([
      { input: logo, left: Math.round((1200 - meta.width) / 2), top: Math.round((630 - meta.height) / 2) },
      { input: bar, left: 0, top: 622 },
    ])
    .png()
    .toFile(path.join(brandDir, 'og.png'));
}

// Expo / native app icons
await sharp(await squareIcon(limeMark, 1024, { background: INK, padding: 0.22, radius: 0 })).toFile(path.join(mobileAssets, 'icon.png'));
await sharp(await squareIcon(limeMark, 1024, { background: { r: 0, g: 0, b: 0, alpha: 0 }, padding: 0.3, radius: 0 })).toFile(
  path.join(mobileAssets, 'android-icon-foreground.png'),
);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: INK } }).png().toFile(path.join(mobileAssets, 'android-icon-background.png'));
await sharp(await squareIcon(await tint(whiteMark, { r: 255, g: 255, b: 255 }), 1024, { background: { r: 0, g: 0, b: 0, alpha: 0 }, padding: 0.3, radius: 0 })).toFile(
  path.join(mobileAssets, 'android-icon-monochrome.png'),
);
await sharp(await squareIcon(limeMark, 512, { background: { r: 0, g: 0, b: 0, alpha: 0 }, padding: 0.05, radius: 0 })).toFile(path.join(mobileAssets, 'splash-icon.png'));
await sharp(await squareIcon(limeMark, 64, { background: INK, padding: 0.15, radius: 0.2 })).toFile(path.join(mobileAssets, 'favicon.png'));
await sharp(await wordmark(WHITE)).resize({ width: 600 }).toFile(path.join(mobileAssets, 'wordmark-white.png'));

console.info('Brand assets generated.');
