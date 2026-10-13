import type { FontId } from './fonts';
import type { ResolvedTheme } from './resolve';
import type { ThemeManifest } from './schema';

/**
 * React Native projection of a resolved theme. The mobile app loads a subset of the allowlisted fonts and
 * maps others to the closest category; layout descriptors use the manifest's mobile settings.
 */
export interface NativeTheme {
  mode: 'dark' | 'light';
  colors: ResolvedTheme['colors'];
  radius: ResolvedTheme['radius'];
  spacing: (n: number) => number;
  fonts: { heading: string; body: string; mono: string };
  headingTransform: 'none' | 'uppercase';
  headingWeight: '400' | '500' | '600' | '700' | '800' | '900';
  headingLetterSpacing: number;
  borderWidth: number;
  cardStyle: ThemeManifest['components']['card'];
  buttonStyle: ThemeManifest['components']['button'];
  messageStyle: ThemeManifest['components']['messageStyle'];
  avatarRadius: (size: number) => number;
  navigation: ThemeManifest['layout']['mobile']['navigation'];
  compactHeader: boolean;
}

/** Fonts bundled in the mobile app; others fall back by category. */
export const NATIVE_FONT_FAMILIES: Partial<Record<FontId, string>> = {
  inter: 'Inter',
  'bebas-neue': 'BebasNeue',
  'playfair-display': 'PlayfairDisplay',
  'barlow-condensed': 'BarlowCondensed',
  'zen-kaku-gothic-new': 'ZenKakuGothicNew',
};

function nativeFont(id: FontId, fallback: string): string {
  return NATIVE_FONT_FAMILIES[id] ?? fallback;
}

export function toNativeTheme(theme: ResolvedTheme, systemFont = 'System'): NativeTheme {
  const m = theme.manifest;
  const shape = m.components.avatarShape;
  return {
    mode: theme.mode,
    colors: theme.colors,
    radius: theme.radius,
    spacing: (n: number) => Math.round(n * 4 * theme.densityScale),
    fonts: {
      heading: nativeFont(m.typography.heading, systemFont),
      body: nativeFont(m.typography.body, systemFont),
      mono: nativeFont(m.typography.mono, 'monospace'),
    },
    headingTransform: m.typography.headingCase,
    headingWeight: String(m.typography.headingWeight) as NativeTheme['headingWeight'],
    headingLetterSpacing: m.typography.headingTracking * 16,
    borderWidth: m.shape.borderWidth,
    cardStyle: m.components.card,
    buttonStyle: m.components.button,
    messageStyle: m.components.messageStyle,
    avatarRadius: (size: number) => (shape === 'circle' ? size / 2 : shape === 'rounded' ? Math.round(size * 0.25) : 2),
    navigation: m.layout.mobile.navigation,
    compactHeader: m.layout.mobile.compactHeader,
  };
}
