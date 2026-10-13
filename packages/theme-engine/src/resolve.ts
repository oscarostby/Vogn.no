import { contrastRatio, ensureContrast, isDark, mixHex, readableOn, withAlpha } from '@vogn/utils';
import { type FontId, fontStack } from './fonts';
import { DEFAULT_THEME } from './presets';
import { MAX_MANIFEST_BYTES, type ThemeManifest, themeManifestSchema, type ThemePalette } from './schema';

export interface ResolvedColors extends ThemePalette {
  /** Accent adjusted for use as text/links on the background. */
  accentText: string;
  /** Primary adjusted for use as text on the background. */
  primaryText: string;
  focusRing: string;
  surfaceHover: string;
  borderSubtle: string;
  overlay: string;
}

export interface ResolvedTheme {
  manifest: ThemeManifest;
  mode: 'dark' | 'light';
  colors: ResolvedColors;
  fonts: { heading: FontId; body: FontId; mono: FontId };
  radius: { sm: number; md: number; lg: number; xl: number };
  densityScale: number;
  shadows: { card: string; raised: string };
  motionEnabled: boolean;
  effectsEnabled: boolean;
  /** Human-readable notes about automatic accessibility corrections. */
  corrections: string[];
}

export interface ResolveOptions {
  /** Requested colour mode; ignored unless the theme provides `altColors` and allows switching. */
  mode?: 'dark' | 'light';
  reducedMotion?: boolean;
}

function fixPalette(p: ThemePalette, corrections: string[]): ResolvedColors {
  const fixed: ThemePalette = { ...p };

  const fix = (key: keyof ThemePalette, against: string[], ratio: number, label: string) => {
    let value = fixed[key];
    for (const bg of against) {
      const next = ensureContrast(value, bg, ratio);
      if (next !== value.toUpperCase() && contrastRatio(value, bg) < ratio) {
        corrections.push(`${label} adjusted for readability (contrast ${contrastRatio(value, bg).toFixed(2)}:1 → ≥${ratio}:1).`);
      }
      value = next;
    }
    fixed[key] = value;
  };

  fix('text', [fixed.background, fixed.surface, fixed.surfaceElevated], 4.5, 'Text colour');
  fix('textMuted', [fixed.background, fixed.surface], 4.5, 'Muted text colour');

  if (contrastRatio(fixed.primaryContrast, fixed.primary) < 4.5) {
    const better = readableOn(fixed.primary);
    corrections.push('Button text colour adjusted to stay readable on the primary colour.');
    fixed.primaryContrast = better;
  }

  const accentText = ensureContrast(fixed.accent, fixed.background, 4.5);
  const primaryText = ensureContrast(fixed.primary, fixed.background, 4.5);
  const focusRing = ensureContrast(fixed.accent, fixed.background, 3);
  const dark = isDark(fixed.background);

  return {
    ...fixed,
    accentText,
    primaryText,
    focusRing,
    surfaceHover: mixHex(fixed.surface, dark ? '#FFFFFF' : '#000000', dark ? 0.05 : 0.035),
    borderSubtle: mixHex(fixed.border, fixed.background, 0.45),
    overlay: withAlpha(dark ? '#000000' : '#101114', dark ? 0.6 : 0.4),
  };
}

const DENSITY: Record<ThemeManifest['shape']['density'], number> = {
  compact: 0.85,
  comfortable: 1,
  spacious: 1.2,
};

export function resolveTheme(manifest: ThemeManifest, options: ResolveOptions = {}): ResolvedTheme {
  const corrections: string[] = [];
  const useAlt = !!options.mode && options.mode !== manifest.mode && manifest.allowModeSwitch && !!manifest.altColors;
  const mode = useAlt ? (options.mode as 'dark' | 'light') : manifest.mode;
  const palette = useAlt && manifest.altColors ? manifest.altColors : manifest.colors;
  const colors = fixPalette(palette, corrections);
  const r = manifest.shape.radius;
  const motionEnabled = !options.reducedMotion && manifest.motion.preset !== 'none';

  const shadowColor = isDark(colors.background) ? 'rgba(0,0,0,0.55)' : 'rgba(30,25,15,0.12)';
  const shadows = (() => {
    switch (manifest.shape.shadow) {
      case 'none':
        return { card: 'none', raised: 'none' };
      case 'hard':
        return { card: `4px 4px 0 0 ${withAlpha(colors.primary, 0.9)}`, raised: `6px 6px 0 0 ${withAlpha(colors.primary, 0.9)}` };
      case 'glow':
        return {
          card: `0 0 0 1px ${withAlpha(colors.primary, 0.25)}, 0 0 24px -6px ${withAlpha(colors.primary, 0.45)}`,
          raised: `0 0 0 1px ${withAlpha(colors.accent, 0.35)}, 0 0 36px -4px ${withAlpha(colors.accent, 0.45)}`,
        };
      default:
        return { card: `0 1px 2px ${shadowColor}`, raised: `0 12px 32px -12px ${shadowColor}` };
    }
  })();

  return {
    manifest,
    mode,
    colors,
    fonts: { heading: manifest.typography.heading, body: manifest.typography.body, mono: manifest.typography.mono },
    radius: { sm: Math.max(0, Math.round(r * 0.5)), md: r, lg: Math.round(r * 1.5), xl: Math.round(r * 2) },
    densityScale: DENSITY[manifest.shape.density],
    shadows,
    motionEnabled,
    effectsEnabled: motionEnabled && manifest.background.effect !== 'none',
    corrections,
  };
}

/** CSS custom properties consumed by the web renderer (scoped to the crew container). */
export function themeCssVariables(theme: ResolvedTheme): Record<string, string> {
  const { colors, manifest } = theme;
  const t = manifest.typography;
  return {
    '--ct-bg': colors.background,
    '--ct-surface': colors.surface,
    '--ct-surface-2': colors.surfaceElevated,
    '--ct-surface-hover': colors.surfaceHover,
    '--ct-border': colors.border,
    '--ct-border-subtle': colors.borderSubtle,
    '--ct-text': colors.text,
    '--ct-muted': colors.textMuted,
    '--ct-primary': colors.primary,
    '--ct-primary-contrast': colors.primaryContrast,
    '--ct-primary-text': colors.primaryText,
    '--ct-secondary': colors.secondary,
    '--ct-accent': colors.accent,
    '--ct-accent-text': colors.accentText,
    '--ct-success': colors.success,
    '--ct-warning': colors.warning,
    '--ct-danger': colors.danger,
    '--ct-focus': colors.focusRing,
    '--ct-overlay': colors.overlay,
    '--ct-radius-sm': `${theme.radius.sm}px`,
    '--ct-radius': `${theme.radius.md}px`,
    '--ct-radius-lg': `${theme.radius.lg}px`,
    '--ct-radius-xl': `${theme.radius.xl}px`,
    '--ct-border-width': `${manifest.shape.borderWidth}px`,
    '--ct-density': String(theme.densityScale),
    '--ct-shadow-card': theme.shadows.card,
    '--ct-shadow-raised': theme.shadows.raised,
    '--ct-font-heading': fontStack(t.heading),
    '--ct-font-body': fontStack(t.body),
    '--ct-font-mono': fontStack(t.mono),
    '--ct-type-scale': String(t.scale),
    '--ct-heading-weight': String(t.headingWeight),
    '--ct-heading-case': t.headingCase,
    '--ct-heading-tracking': `${t.headingTracking}em`,
    '--ct-line-height': String(t.bodyLineHeight),
    '--ct-icon-stroke': String(manifest.shape.iconStroke),
    '--ct-sidebar-width': `${manifest.layout.desktop.sidebarWidth}px`,
  };
}

/* -------------------------------------------------------------------------- */
/* Parsing, migration, fallback                                                */
/* -------------------------------------------------------------------------- */

export interface ManifestIssue {
  path: string;
  message: string;
}

export type ParseManifestResult = { ok: true; manifest: ThemeManifest } | { ok: false; issues: ManifestIssue[] };

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registered schema migrations keyed by the version they upgrade *from*. v1 is the first public schema, so the
 * registry is empty; new versions add an entry here and bump THEME_SCHEMA_VERSION.
 */
const MIGRATIONS: Record<number, Migration> = {};

export function migrateManifest(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  let current = raw as Record<string, unknown>;
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 1;
  let guard = 0;
  while (MIGRATIONS[version] && guard++ < 20) {
    current = MIGRATIONS[version]!(current);
    version = current.schemaVersion as number;
  }
  return current;
}

export function parseThemeManifest(raw: unknown): ParseManifestResult {
  let size = 0;
  try {
    size = JSON.stringify(raw)?.length ?? 0;
  } catch {
    return { ok: false, issues: [{ path: '', message: 'theme.invalidJson' }] };
  }
  if (size > MAX_MANIFEST_BYTES) return { ok: false, issues: [{ path: '', message: 'theme.tooLarge' }] };
  const result = themeManifestSchema.safeParse(migrateManifest(raw));
  if (result.success) return { ok: true, manifest: result.data };
  return {
    ok: false,
    issues: result.error.issues.slice(0, 50).map((i) => ({ path: i.path.join('.'), message: i.message })),
  };
}

/** Returns a valid manifest, falling back to the VOGN default theme when validation fails. */
export function safeManifest(raw: unknown): { manifest: ThemeManifest; fellBack: boolean } {
  const parsed = parseThemeManifest(raw);
  if (parsed.ok) return { manifest: parsed.manifest, fellBack: false };
  return { manifest: structuredClone(DEFAULT_THEME), fellBack: true };
}

/* -------------------------------------------------------------------------- */
/* Marketplace helpers                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Removes crew-specific references and content media before a theme is shared publicly:
 * channel/role overrides, featured members/cars/events, curated gallery images and channel nav targets.
 */
export function sanitizeForMarketplace(manifest: ThemeManifest): ThemeManifest {
  const m = structuredClone(manifest);
  m.channelOverrides = {};
  m.roleStyles = {};
  m.navigation = m.navigation.filter((n) => n.target.kind !== 'channel');
  for (const page of m.pages) {
    for (const s of page.sections) {
      for (const widget of s.widgets) {
        switch (widget.type) {
          case 'featured_member':
            widget.props.userId = null;
            break;
          case 'featured_car':
            widget.props.vehicleId = null;
            break;
          case 'vehicle_gallery':
            widget.props.vehicleIds = [];
            widget.props.source = 'members';
            break;
          case 'announcements':
          case 'popular_discussions':
            widget.props.channelId = null;
            break;
          case 'countdown':
            widget.props.eventId = null;
            break;
          case 'image_gallery':
            widget.props.images = [];
            break;
          case 'welcome':
            widget.props.imageUrl = null;
            break;
          default:
            break;
        }
      }
    }
  }
  return m;
}

export type ThemeInstallMode = 'style' | 'full';

/**
 * Applies a (marketplace) theme onto a crew manifest. `style` keeps the crew's pages, navigation and
 * overrides; `full` also replaces pages and navigation.
 */
export function applyTheme(target: ThemeManifest, source: ThemeManifest, mode: ThemeInstallMode): ThemeManifest {
  const next = structuredClone(target);
  const s = structuredClone(source);
  next.meta = { ...next.meta, presetId: s.meta.presetId, name: s.meta.name };
  next.mode = s.mode;
  next.colors = s.colors;
  next.altColors = s.altColors;
  next.allowModeSwitch = s.allowModeSwitch;
  next.typography = s.typography;
  next.shape = s.shape;
  next.background = s.background;
  next.header = { ...s.header };
  next.components = s.components;
  next.layout = s.layout;
  next.motion = s.motion;
  if (mode === 'full') {
    next.pages = s.pages;
    next.navigation = s.navigation;
  }
  return next;
}
