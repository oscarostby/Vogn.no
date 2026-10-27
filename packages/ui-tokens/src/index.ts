/**
 * VOGN global design tokens. Shared by the web app (CSS variables), the mobile app (StyleSheet values)
 * and the theme engine (default theme fallback).
 */

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentContrast: string;
  accentMuted: string;
  info: string;
  success: string;
  warning: string;
  danger: string;
  dangerContrast: string;
  focus: string;
  overlay: string;
}

export const darkColors: ColorTokens = {
  background: '#090A0C',
  surface: '#121418',
  surfaceElevated: '#1C1F25',
  surfaceSunken: '#07080A',
  border: '#282C33',
  borderStrong: '#424750',
  text: '#F2F3F5',
  textMuted: '#A5A9B2',
  textSubtle: '#8A909C',
  accent: '#F2F3F5',
  accentContrast: '#090A0C',
  accentMuted: '#24272E',
  info: '#6CB6FF',
  success: '#5FD38D',
  warning: '#F2C14E',
  danger: '#FF6B6B',
  dangerContrast: '#090A0C',
  focus: '#F2F3F5',
  overlay: 'rgba(5, 6, 8, 0.72)',
};

export const lightColors: ColorTokens = {
  background: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EFEFEC',
  border: '#E1E1DC',
  borderStrong: '#C9C9C2',
  text: '#121316',
  textMuted: '#5B5F68',
  textSubtle: '#80848C',
  accent: '#22252B',
  accentContrast: '#FFFFFF',
  accentMuted: '#E7E9ED',
  info: '#1F6FEB',
  success: '#1A7F4B',
  warning: '#9A6700',
  danger: '#C62828',
  dangerContrast: '#FFFFFF',
  focus: '#22252B',
  overlay: 'rgba(18, 19, 22, 0.45)',
};

/** Brand constants that do not change between modes. */
export const brand = {
  name: 'VOGN',
  tagline: 'Your crew. Your space.',
  accent: '#F2F3F5',
  ink: '#090A0C',
  domain: 'vogn.no',
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** 4px base spacing scale. */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const fontSizes = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 48,
  '5xl': 64,
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const motion = {
  durationFast: 120,
  durationBase: 180,
  durationSlow: 280,
  easeOut: [0.16, 1, 0.3, 1] as const,
  easeInOut: [0.65, 0, 0.35, 1] as const,
} as const;

export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 40,
  overlay: 50,
  modal: 60,
  toast: 70,
  tooltip: 80,
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type ColorMode = 'dark' | 'light';

export function colorsFor(mode: ColorMode): ColorTokens {
  return mode === 'dark' ? darkColors : lightColors;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** CSS custom properties (`--vogn-*`) for a colour mode. */
export function colorCssVariables(mode: ColorMode): Record<string, string> {
  const colors = colorsFor(mode);
  return Object.fromEntries(Object.entries(colors).map(([k, v]) => [`--vogn-${kebab(k)}`, v]));
}
