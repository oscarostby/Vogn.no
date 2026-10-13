import { z } from 'zod';
import { FONT_IDS } from './fonts';
import { localId, mediaUrl, safeLink, themeIcon, widgetSchema } from './widgets';

export const THEME_SCHEMA_VERSION = 1 as const;

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'theme.color');
const entityId = z.string().regex(/^[a-f0-9]{24}$/, 'theme.entityId');
const fontId = z.enum(FONT_IDS);
const shortText = (max: number) =>
  z
    .string()
    .max(max)
    // eslint-disable-next-line no-control-regex
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, ''));

export const paletteSchema = z.strictObject({
  background: hex,
  surface: hex,
  surfaceElevated: hex,
  border: hex,
  text: hex,
  textMuted: hex,
  primary: hex,
  primaryContrast: hex,
  secondary: hex,
  accent: hex,
  success: hex,
  warning: hex,
  danger: hex,
});
export type ThemePalette = z.infer<typeof paletteSchema>;

export const typographySchema = z.strictObject({
  heading: fontId,
  body: fontId,
  mono: fontId,
  scale: z.number().min(0.85).max(1.3),
  headingWeight: z.union([
    z.literal(400),
    z.literal(500),
    z.literal(600),
    z.literal(700),
    z.literal(800),
    z.literal(900),
  ]),
  headingCase: z.enum(['none', 'uppercase']),
  headingTracking: z.number().min(-0.06).max(0.3),
  bodyLineHeight: z.number().min(1.3).max(1.9),
});

export const shapeSchema = z.strictObject({
  radius: z.number().int().min(0).max(28),
  borderWidth: z.number().int().min(0).max(3),
  density: z.enum(['compact', 'comfortable', 'spacious']),
  shadow: z.enum(['none', 'soft', 'hard', 'glow']),
  iconStroke: z.number().min(1).max(2.75),
});

export const BACKGROUND_PATTERNS = [
  'none',
  'grid',
  'dots',
  'noise',
  'scanlines',
  'topographic',
  'carbon',
  'diagonal',
  'hex',
  'seigaiha',
  'pinstripe',
  'checker',
] as const;

export const BACKGROUND_EFFECTS = ['none', 'aurora', 'neon-grid', 'rain', 'dust', 'light-sweep', 'heat-haze'] as const;

export const gradientSchema = z.strictObject({
  kind: z.enum(['linear', 'radial']),
  angle: z.number().int().min(0).max(360),
  stops: z
    .array(z.strictObject({ color: hex, position: z.number().min(0).max(100) }))
    .min(2)
    .max(5),
});

export const backgroundSchema = z.strictObject({
  type: z.enum(['solid', 'gradient', 'image', 'video']),
  color: hex,
  gradient: gradientSchema.nullable(),
  imageUrl: mediaUrl.nullable(),
  videoUrl: mediaUrl.nullable(),
  overlayColor: hex,
  overlayOpacity: z.number().min(0).max(0.95),
  blur: z.number().int().min(0).max(24),
  pattern: z.enum(BACKGROUND_PATTERNS),
  patternOpacity: z.number().min(0).max(0.5),
  effect: z.enum(BACKGROUND_EFFECTS),
  /** Effects are always disabled for users who prefer reduced motion. */
  effectIntensity: z.number().min(0).max(1),
});

export const headerSchema = z.strictObject({
  style: z.enum(['banner', 'minimal', 'split', 'fullbleed', 'editorial', 'plate']),
  height: z.enum(['sm', 'md', 'lg', 'xl']),
  align: z.enum(['left', 'center']),
  showIcon: z.boolean(),
  showStats: z.boolean(),
  overlayOpacity: z.number().min(0).max(0.9),
  tagline: shortText(120).nullable(),
  /** Decorative text, e.g. vertical Japanese characters in Tokyo Midnight. Rendered aria-hidden. */
  decorativeText: shortText(24).nullable(),
  decorativeStyle: z.enum(['none', 'vertical', 'outline', 'stamp']),
});

export const componentsSchema = z.strictObject({
  button: z.enum(['solid', 'outline', 'soft', 'pill', 'sharp', 'glow']),
  card: z.enum(['flat', 'outlined', 'elevated', 'glass', 'brutal', 'editorial', 'plate']),
  input: z.enum(['filled', 'outlined', 'underline']),
  channelList: z.enum(['compact', 'comfortable', 'icons', 'cards']),
  messageStyle: z.enum(['cozy', 'compact', 'bubbles']),
  avatarShape: z.enum(['circle', 'rounded', 'square']),
  badge: z.enum(['pill', 'tag', 'chip']),
  divider: z.enum(['line', 'dashed', 'gradient', 'none']),
});

export const layoutSchema = z.strictObject({
  desktop: z.strictObject({
    navigation: z.enum(['sidebar-left', 'sidebar-right', 'top']),
    sidebarWidth: z.number().int().min(220).max(340),
    contentWidth: z.enum(['narrow', 'normal', 'wide', 'full']),
    showMemberList: z.boolean(),
  }),
  tablet: z.strictObject({
    navigation: z.enum(['sidebar-left', 'top', 'drawer']),
  }),
  mobile: z.strictObject({
    navigation: z.enum(['tabs', 'drawer', 'top']),
    compactHeader: z.boolean(),
  }),
});

export const sectionSchema = z.strictObject({
  id: localId,
  title: shortText(80).nullable(),
  subtitle: shortText(160).nullable(),
  background: z.enum(['none', 'surface', 'elevated', 'accent', 'inverted']),
  padding: z.enum(['none', 'sm', 'md', 'lg']),
  fullBleed: z.boolean(),
  gap: z.enum(['sm', 'md', 'lg']),
  widgets: z.array(widgetSchema).max(12),
});
export type ThemeSection = z.infer<typeof sectionSchema>;

export const pageSchema = z.strictObject({
  id: localId,
  slug: z.string().regex(/^[a-z0-9-]{1,32}$/, 'theme.pageSlug'),
  title: shortText(40),
  icon: themeIcon,
  showInNav: z.boolean(),
  sections: z.array(sectionSchema).max(20),
});
export type ThemePage = z.infer<typeof pageSchema>;

export const navItemSchema = z.strictObject({
  id: localId,
  label: shortText(30),
  icon: themeIcon,
  target: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('page'), pageId: localId }),
    z.strictObject({ kind: z.literal('channel'), channelId: entityId }),
    z.strictObject({ kind: z.literal('events') }),
    z.strictObject({ kind: z.literal('members') }),
    z.strictObject({ kind: z.literal('url'), url: safeLink }),
  ]),
});
export type ThemeNavItem = z.infer<typeof navItemSchema>;

export const channelOverrideSchema = z.strictObject({
  accent: hex.nullable(),
  icon: themeIcon.nullable(),
  tint: z.boolean(),
});

export const roleStyleSchema = z.strictObject({
  badgeIcon: themeIcon.nullable(),
  badgeStyle: z.enum(['solid', 'outline', 'glow']),
  nameEffect: z.enum(['none', 'glow', 'gradient']),
});

export const motionSchema = z.strictObject({
  preset: z.enum(['none', 'subtle', 'smooth', 'energetic']),
  hoverLift: z.boolean(),
  pageTransition: z.enum(['none', 'fade', 'slide']),
});

const boundedRecord = <T extends z.ZodType>(value: T, max: number) =>
  z.record(entityId, value).refine((r) => Object.keys(r).length <= max, 'theme.tooMany');

export const themeManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(THEME_SCHEMA_VERSION),
    meta: z.strictObject({
      name: shortText(60),
      description: shortText(300).nullable(),
      presetId: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable(),
      tags: z.array(shortText(24)).max(8),
    }),
    mode: z.enum(['dark', 'light']),
    /** Palette for `mode`. */
    colors: paletteSchema,
    /** Optional palette for the opposite mode (members can switch if the crew allows). */
    altColors: paletteSchema.nullable(),
    allowModeSwitch: z.boolean(),
    typography: typographySchema,
    shape: shapeSchema,
    background: backgroundSchema,
    header: headerSchema,
    components: componentsSchema,
    layout: layoutSchema,
    pages: z.array(pageSchema).min(1).max(10),
    navigation: z.array(navItemSchema).max(12),
    channelOverrides: boundedRecord(channelOverrideSchema, 200),
    roleStyles: boundedRecord(roleStyleSchema, 100),
    motion: motionSchema,
  })
  .superRefine((m, ctx) => {
    const pageIds = new Set<string>();
    const slugs = new Set<string>();
    const widgetIds = new Set<string>();
    m.pages.forEach((p, pi) => {
      if (pageIds.has(p.id)) ctx.addIssue({ code: 'custom', message: 'theme.duplicateId', path: ['pages', pi, 'id'] });
      if (slugs.has(p.slug)) ctx.addIssue({ code: 'custom', message: 'theme.duplicateSlug', path: ['pages', pi, 'slug'] });
      pageIds.add(p.id);
      slugs.add(p.slug);
      p.sections.forEach((s, si) =>
        s.widgets.forEach((w, wi) => {
          if (widgetIds.has(w.id))
            ctx.addIssue({
              code: 'custom',
              message: 'theme.duplicateId',
              path: ['pages', pi, 'sections', si, 'widgets', wi, 'id'],
            });
          widgetIds.add(w.id);
        }),
      );
    });
    if (!m.pages.some((p) => p.slug === 'home')) {
      ctx.addIssue({ code: 'custom', message: 'theme.homeRequired', path: ['pages'] });
    }
    m.navigation.forEach((n, ni) => {
      if (n.target.kind === 'page' && !pageIds.has(n.target.pageId)) {
        ctx.addIssue({ code: 'custom', message: 'theme.navTarget', path: ['navigation', ni, 'target'] });
      }
    });
    const widgetCount = m.pages.reduce((sum, p) => sum + p.sections.reduce((s2, s) => s2 + s.widgets.length, 0), 0);
    if (widgetCount > 120) ctx.addIssue({ code: 'custom', message: 'theme.tooManyWidgets', path: ['pages'] });
  });

export type ThemeManifest = z.infer<typeof themeManifestSchema>;
export type ThemeManifestInput = z.input<typeof themeManifestSchema>;

/** Maximum serialised manifest size accepted by the API. */
export const MAX_MANIFEST_BYTES = 256 * 1024;
