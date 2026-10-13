import { withAlpha } from '@vogn/utils';
import type { ResolvedTheme } from './resolve';
import type { ThemeManifest } from './schema';

/**
 * Builds CSS background layers from a *validated* manifest. Values interpolated here are hex colours and
 * clamped numbers only, so the output cannot contain injected CSS.
 */

function svgData(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function patternLayer(pattern: ThemeManifest['background']['pattern'], color: string, opacity: number): string | null {
  if (pattern === 'none' || opacity <= 0) return null;
  const c = withAlpha(color, opacity);
  switch (pattern) {
    case 'grid':
      return `linear-gradient(${c} 1px, transparent 1px) 0 0 / 32px 32px, linear-gradient(90deg, ${c} 1px, transparent 1px) 0 0 / 32px 32px`;
    case 'dots':
      return `radial-gradient(${c} 1px, transparent 1.5px) 0 0 / 18px 18px`;
    case 'scanlines':
      return `repeating-linear-gradient(0deg, ${c} 0px, ${c} 1px, transparent 1px, transparent 3px)`;
    case 'diagonal':
      return `repeating-linear-gradient(135deg, ${c} 0px, ${c} 10px, transparent 10px, transparent 26px)`;
    case 'pinstripe':
      return `repeating-linear-gradient(90deg, ${c} 0px, ${c} 1px, transparent 1px, transparent 14px)`;
    case 'checker':
      return `conic-gradient(${c} 25%, transparent 0 50%, ${c} 0 75%, transparent 0) 0 0 / 28px 28px`;
    case 'carbon':
      return `linear-gradient(27deg, ${c} 5px, transparent 5px) 0 5px / 20px 20px, linear-gradient(207deg, ${c} 5px, transparent 5px) 10px 0px / 20px 20px`;
    case 'hex':
      return `${svgData(
        `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'><path fill='none' stroke='${color}' stroke-opacity='${opacity}' d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/></svg>`,
      )} 0 0 / 28px 49px`;
    case 'seigaiha':
      return `${svgData(
        `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='20' viewBox='0 0 40 20'><g fill='none' stroke='${color}' stroke-opacity='${opacity}'><circle cx='20' cy='20' r='18'/><circle cx='20' cy='20' r='13'/><circle cx='20' cy='20' r='8'/><circle cx='0' cy='10' r='18'/><circle cx='40' cy='10' r='18'/></g></svg>`,
      )} 0 0 / 40px 20px`;
    case 'topographic':
      return `${svgData(
        `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'><g fill='none' stroke='${color}' stroke-opacity='${opacity}' stroke-width='1.2'><path d='M-10 40c40-30 80 10 120-10s80-30 140 0'/><path d='M-10 70c50-25 90 15 130-5s70-25 130 5'/><path d='M-10 110c30-20 70 25 120 5s90-35 140-5'/><path d='M20 160c30-35 90-35 110-5s60 40 100 10'/><path d='M40 175c25-20 70-22 85 0s45 28 75 5'/><path d='M-10 210c50-20 100 20 140 0s70-20 120 5'/><ellipse cx='175' cy='120' rx='28' ry='16'/><ellipse cx='175' cy='120' rx='14' ry='8'/></g></svg>`,
      )} 0 0 / 240px 240px`;
    case 'noise':
      return `${svgData(
        `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${opacity} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
      )} 0 0 / 160px 160px`;
    default:
      return null;
  }
}

function gradientCss(g: NonNullable<ThemeManifest['background']['gradient']>): string {
  const stops = [...g.stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ');
  return g.kind === 'radial' ? `radial-gradient(120% 90% at 50% 0%, ${stops})` : `linear-gradient(${g.angle}deg, ${stops})`;
}

export interface BackgroundStyle {
  backgroundColor: string;
  backgroundImage?: string;
  /** Shorthand `background` used when patterns need per-layer sizing. */
  background?: string;
}

/** Page background for the crew container (excluding video, which renderers add as an element). */
export function backgroundStyle(theme: ResolvedTheme): BackgroundStyle {
  const bg = theme.manifest.background;
  const layers: string[] = [];
  const patternColor = theme.mode === 'dark' ? '#FFFFFF' : '#000000';
  const pattern = patternLayer(bg.pattern, bg.pattern === 'topographic' ? theme.colors.textMuted : patternColor, bg.patternOpacity);
  if (pattern) layers.push(pattern);
  if (bg.type === 'image' && bg.imageUrl) {
    if (bg.overlayOpacity > 0) {
      const o = withAlpha(bg.overlayColor, bg.overlayOpacity);
      layers.push(`linear-gradient(${o}, ${o})`);
    }
    layers.push(`url("${encodeURI(bg.imageUrl)}") center / cover no-repeat`);
  } else if (bg.type === 'gradient' && bg.gradient) {
    layers.push(gradientCss(bg.gradient));
  }
  const color = bg.type === 'solid' ? theme.colors.background : bg.color;
  if (!layers.length) return { backgroundColor: color };
  return { backgroundColor: color, background: `${layers.join(', ')}, ${color}` };
}

/** Header banner gradient used when the crew has no banner image. */
export function headerFallbackGradient(theme: ResolvedTheme): string {
  const { primary, secondary, background } = theme.colors;
  return `linear-gradient(120deg, ${withAlpha(primary, 0.55)} 0%, ${withAlpha(secondary, 0.45)} 45%, ${background} 100%)`;
}
