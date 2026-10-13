/** Colour helpers used by the theme engine contrast guard and UI. Hex only (#rgb, #rrggbb). */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

export function parseHex(hex: string): Rgb {
  if (!isHexColor(hex)) throw new Error(`Invalid hex colour: ${hex}`);
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((n) => clampByte(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Linear interpolation between two hex colours. `amount` 0 → a, 1 → b. */
export function mixHex(a: string, b: string, amount: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const t = Math.max(0, Math.min(1, amount));
  return toHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.2;
}

/**
 * Returns `preferred` when it reaches `minRatio` against `background`; otherwise moves it towards
 * black or white (whichever contrasts more) until the ratio is met.
 */
export function ensureContrast(preferred: string, background: string, minRatio = 4.5): string {
  if (contrastRatio(preferred, background) >= minRatio) return preferred.toUpperCase();
  const target = contrastRatio('#FFFFFF', background) >= contrastRatio('#000000', background) ? '#FFFFFF' : '#000000';
  for (let step = 1; step <= 20; step++) {
    const candidate = mixHex(preferred, target, step / 20);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return target;
}

/** Best readable foreground (black/white family) for a given background. */
export function readableOn(background: string, light = '#FFFFFF', dark = '#0B0C0E'): string {
  return contrastRatio(light, background) >= contrastRatio(dark, background) ? light : dark;
}
