import { z } from 'zod';
import { THEME_ICONS } from './icons';

/** Short id used for pages/sections/widgets/nav items inside a manifest. */
export const localId = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/, 'theme.id');
const entityId = z.string().regex(/^[a-f0-9]{24}$/, 'theme.entityId');
const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'theme.color');

const text = (max: number) =>
  z
    .string()
    .max(max)
    // Strip control characters; content is always rendered as text or safe markdown, never HTML.
    // eslint-disable-next-line no-control-regex
    .transform((s) => s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, ''));

function isAllowedMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com';
  } catch {
    return false;
  }
}

function isSafeLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Media must come from VOGN's media CDN (uploaded through the signed upload flow). */
export const mediaUrl = z.string().max(1024).refine(isAllowedMediaUrl, 'theme.mediaUrl');
export const safeLink = z.string().max(2048).refine(isSafeLink, 'theme.linkUrl');
export const themeIcon = z.enum(THEME_ICONS);

function isVideoEmbed(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return ['www.youtube.com', 'youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com'].includes(url.hostname);
  } catch {
    return false;
  }
}

const widgetStyle = z.strictObject({
  variant: z.enum(['default', 'transparent', 'accent', 'outlined', 'inverted']).default('default'),
  accent: hex.nullable().default(null),
});

const span = z.strictObject({
  desktop: z.number().int().min(1).max(12),
  tablet: z.number().int().min(1).max(12),
  mobile: z.enum(['full', 'half']),
});

const common = {
  id: localId,
  title: text(80).nullable().default(null),
  span,
  rowSpan: z.number().int().min(1).max(4).default(1),
  hiddenOn: z.strictObject({ desktop: z.boolean(), mobile: z.boolean() }).default({ desktop: false, mobile: false }),
  style: widgetStyle.default({ variant: 'default', accent: null }),
};

export const WIDGET_TYPES = [
  'welcome',
  'announcements',
  'member_count',
  'featured_member',
  'featured_car',
  'vehicle_gallery',
  'build_projects',
  'upcoming_meets',
  'event_calendar',
  'countdown',
  'rich_text',
  'image_gallery',
  'links',
  'poll',
  'rules',
  'leaderboard',
  'popular_discussions',
  'channel_list',
  'video',
  'stats',
  'spacer',
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export const widgetSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...common,
    type: z.literal('welcome'),
    props: z.strictObject({
      heading: text(80),
      body: text(1000),
      showJoinButton: z.boolean(),
      align: z.enum(['left', 'center']),
      imageUrl: mediaUrl.nullable(),
      eyebrow: text(40).nullable(),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('announcements'),
    props: z.strictObject({ channelId: entityId.nullable(), count: z.number().int().min(1).max(10) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('member_count'),
    props: z.strictObject({
      label: text(40),
      showOnline: z.boolean(),
      display: z.enum(['big-number', 'compact', 'avatars']),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('featured_member'),
    props: z.strictObject({ userId: entityId.nullable(), caption: text(160).nullable() }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('featured_car'),
    props: z.strictObject({ vehicleId: entityId.nullable(), caption: text(160).nullable(), showSpecs: z.boolean() }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('vehicle_gallery'),
    props: z.strictObject({
      source: z.enum(['members', 'selected']),
      vehicleIds: z.array(entityId).max(12),
      count: z.number().int().min(2).max(24),
      layout: z.enum(['grid', 'carousel', 'mosaic']),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('build_projects'),
    props: z.strictObject({ count: z.number().int().min(1).max(12), sort: z.enum(['recent', 'popular']) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('upcoming_meets'),
    props: z.strictObject({ count: z.number().int().min(1).max(10), layout: z.enum(['list', 'cards', 'ticket']) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('event_calendar'),
    props: z.strictObject({ months: z.number().int().min(1).max(3) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('countdown'),
    props: z.strictObject({ eventId: entityId.nullable(), label: text(60) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('rich_text'),
    props: z.strictObject({ markdown: text(4000), align: z.enum(['left', 'center']), size: z.enum(['sm', 'md', 'lg']) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('image_gallery'),
    props: z.strictObject({
      images: z.array(z.strictObject({ url: mediaUrl, alt: text(120) })).max(24),
      layout: z.enum(['grid', 'carousel', 'mosaic']),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('links'),
    props: z.strictObject({
      links: z.array(z.strictObject({ label: text(40), url: safeLink, icon: themeIcon.nullable() })).max(12),
      layout: z.enum(['buttons', 'list', 'tiles']),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('poll'),
    props: z.strictObject({
      question: text(160),
      options: z.array(text(80)).min(2).max(6),
      closesAt: z.iso.datetime({ offset: true }).nullable(),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('rules'),
    props: z.strictObject({ source: z.enum(['crew', 'custom']), items: z.array(text(300)).max(20), numbered: z.boolean() }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('leaderboard'),
    props: z.strictObject({
      metric: z.enum(['messages', 'builds', 'reactions']),
      period: z.enum(['7d', '30d', 'all']),
      count: z.number().int().min(3).max(10),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('popular_discussions'),
    props: z.strictObject({ channelId: entityId.nullable(), count: z.number().int().min(1).max(10) }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('channel_list'),
    props: z.strictObject({ layout: z.enum(['list', 'tiles']), showTopics: z.boolean() }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('video'),
    props: z.strictObject({
      url: z.string().max(500).refine(isVideoEmbed, 'theme.videoUrl').nullable(),
      caption: text(160).nullable(),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('stats'),
    props: z.strictObject({
      items: z.array(z.enum(['members', 'channels', 'builds', 'events', 'founded'])).min(1).max(5),
    }),
  }),
  z.strictObject({
    ...common,
    type: z.literal('spacer'),
    props: z.strictObject({ size: z.enum(['sm', 'md', 'lg']), divider: z.boolean() }),
  }),
]);

export type ThemeWidget = z.infer<typeof widgetSchema>;
export type WidgetOf<T extends WidgetType> = Extract<ThemeWidget, { type: T }>;
export type WidgetProps<T extends WidgetType> = WidgetOf<T>['props'];

export interface WidgetDefinition<T extends WidgetType = WidgetType> {
  type: T;
  label: string;
  description: string;
  icon: (typeof THEME_ICONS)[number];
  category: 'community' | 'garage' | 'events' | 'content' | 'layout';
  defaultSpan: { desktop: number; tablet: number; mobile: 'full' | 'half' };
  minDesktopSpan: number;
  defaultTitle: string | null;
  defaultProps: WidgetProps<T>;
}

type Definitions = { [K in WidgetType]: WidgetDefinition<K> };

export const WIDGET_DEFINITIONS: Definitions = {
  welcome: {
    type: 'welcome',
    label: 'Welcome',
    description: 'Hero greeting with optional image and join button.',
    icon: 'sparkles',
    category: 'content',
    defaultSpan: { desktop: 12, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: null,
    defaultProps: {
      heading: 'Welcome to the crew',
      body: 'Introduce your community, what you build and how to get involved.',
      showJoinButton: true,
      align: 'left',
      imageUrl: null,
      eyebrow: null,
    },
  },
  announcements: {
    type: 'announcements',
    label: 'Latest announcements',
    description: 'Most recent posts from an announcement channel.',
    icon: 'megaphone',
    category: 'community',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: 'Announcements',
    defaultProps: { channelId: null, count: 3 },
  },
  member_count: {
    type: 'member_count',
    label: 'Member count',
    description: 'Live member and online count.',
    icon: 'users',
    category: 'community',
    defaultSpan: { desktop: 3, tablet: 6, mobile: 'half' },
    minDesktopSpan: 2,
    defaultTitle: null,
    defaultProps: { label: 'Members', showOnline: true, display: 'big-number' },
  },
  featured_member: {
    type: 'featured_member',
    label: 'Featured member',
    description: 'Spotlight a member (respects their privacy settings).',
    icon: 'star',
    category: 'community',
    defaultSpan: { desktop: 4, tablet: 6, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: 'Member spotlight',
    defaultProps: { userId: null, caption: null },
  },
  featured_car: {
    type: 'featured_car',
    label: 'Featured car',
    description: 'Highlight a build shared with the crew.',
    icon: 'car-front',
    category: 'garage',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: 'Car of the month',
    defaultProps: { vehicleId: null, caption: null, showSpecs: true },
  },
  vehicle_gallery: {
    type: 'vehicle_gallery',
    label: 'Vehicle gallery',
    description: 'Cars members share with the crew.',
    icon: 'camera',
    category: 'garage',
    defaultSpan: { desktop: 12, tablet: 12, mobile: 'full' },
    minDesktopSpan: 6,
    defaultTitle: 'The garage',
    defaultProps: { source: 'members', vehicleIds: [], count: 8, layout: 'grid' },
  },
  build_projects: {
    type: 'build_projects',
    label: 'Current builds',
    description: 'Recently updated build projects.',
    icon: 'wrench',
    category: 'garage',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: 'Builds in progress',
    defaultProps: { count: 4, sort: 'recent' },
  },
  upcoming_meets: {
    type: 'upcoming_meets',
    label: 'Upcoming meets',
    description: 'Next events organised by the crew.',
    icon: 'calendar',
    category: 'events',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: 'Upcoming meets',
    defaultProps: { count: 3, layout: 'list' },
  },
  event_calendar: {
    type: 'event_calendar',
    label: 'Event calendar',
    description: 'Month view of crew events.',
    icon: 'calendar-days',
    category: 'events',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: 'Calendar',
    defaultProps: { months: 1 },
  },
  countdown: {
    type: 'countdown',
    label: 'Countdown',
    description: 'Countdown to the next (or a selected) event.',
    icon: 'timer',
    category: 'events',
    defaultSpan: { desktop: 4, tablet: 6, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: null,
    defaultProps: { eventId: null, label: 'Next meet' },
  },
  rich_text: {
    type: 'rich_text',
    label: 'Text',
    description: 'Formatted text (safe markdown).',
    icon: 'scroll-text',
    category: 'content',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 2,
    defaultTitle: null,
    defaultProps: { markdown: 'Write something about your crew.', align: 'left', size: 'md' },
  },
  image_gallery: {
    type: 'image_gallery',
    label: 'Image gallery',
    description: 'Curated photos uploaded to the crew.',
    icon: 'image',
    category: 'content',
    defaultSpan: { desktop: 12, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: 'Gallery',
    defaultProps: { images: [], layout: 'mosaic' },
  },
  links: {
    type: 'links',
    label: 'Links',
    description: 'External links (https only).',
    icon: 'link',
    category: 'content',
    defaultSpan: { desktop: 4, tablet: 6, mobile: 'full' },
    minDesktopSpan: 2,
    defaultTitle: 'Links',
    defaultProps: { links: [], layout: 'list' },
  },
  poll: {
    type: 'poll',
    label: 'Poll',
    description: 'Members vote once; results update live.',
    icon: 'bar-chart-3',
    category: 'community',
    defaultSpan: { desktop: 4, tablet: 6, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: 'Poll',
    defaultProps: { question: 'Where should the next meet be?', options: ['Option A', 'Option B'], closesAt: null },
  },
  rules: {
    type: 'rules',
    label: 'Rules',
    description: 'Crew rules from settings or custom items.',
    icon: 'shield',
    category: 'community',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: 'Crew rules',
    defaultProps: { source: 'crew', items: [], numbered: true },
  },
  leaderboard: {
    type: 'leaderboard',
    label: 'Leaderboard',
    description: 'Most active members (opt-out respected).',
    icon: 'trophy',
    category: 'community',
    defaultSpan: { desktop: 4, tablet: 6, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: 'Most active',
    defaultProps: { metric: 'messages', period: '30d', count: 5 },
  },
  popular_discussions: {
    type: 'popular_discussions',
    label: 'Popular discussions',
    description: 'Messages with the most replies and reactions this week.',
    icon: 'flame',
    category: 'community',
    defaultSpan: { desktop: 6, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: 'Trending in the crew',
    defaultProps: { channelId: null, count: 4 },
  },
  channel_list: {
    type: 'channel_list',
    label: 'Channel directory',
    description: 'Channels the viewer can access.',
    icon: 'hash',
    category: 'community',
    defaultSpan: { desktop: 4, tablet: 6, mobile: 'full' },
    minDesktopSpan: 3,
    defaultTitle: 'Channels',
    defaultProps: { layout: 'list', showTopics: true },
  },
  video: {
    type: 'video',
    label: 'Video',
    description: 'Embedded YouTube or Vimeo video (privacy-enhanced mode).',
    icon: 'video',
    category: 'content',
    defaultSpan: { desktop: 8, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: null,
    defaultProps: { url: null, caption: null },
  },
  stats: {
    type: 'stats',
    label: 'Crew stats',
    description: 'Key numbers about the crew.',
    icon: 'gauge',
    category: 'community',
    defaultSpan: { desktop: 12, tablet: 12, mobile: 'full' },
    minDesktopSpan: 4,
    defaultTitle: null,
    defaultProps: { items: ['members', 'builds', 'events', 'founded'] },
  },
  spacer: {
    type: 'spacer',
    label: 'Spacer',
    description: 'Vertical space with optional divider.',
    icon: 'route',
    category: 'layout',
    defaultSpan: { desktop: 12, tablet: 12, mobile: 'full' },
    minDesktopSpan: 1,
    defaultTitle: null,
    defaultProps: { size: 'md', divider: false },
  },
};

let counter = 0;
/** Creates a widget instance with default props. `idSeed` keeps ids deterministic in tests/presets. */
export function createWidget<T extends WidgetType>(type: T, idSeed?: string): WidgetOf<T> {
  const def = WIDGET_DEFINITIONS[type] as WidgetDefinition<T>;
  counter = (counter + 1) % 1_000_000;
  const id = idSeed ?? `w-${type.replace(/_/g, '-')}-${Date.now().toString(36)}${counter.toString(36)}`;
  return {
    id,
    type,
    title: def.defaultTitle,
    span: { ...def.defaultSpan },
    rowSpan: 1,
    hiddenOn: { desktop: false, mobile: false },
    style: { variant: 'default', accent: null },
    props: structuredClone(def.defaultProps),
  } as unknown as WidgetOf<T>;
}

/** Converts a YouTube/Vimeo URL into a privacy-enhanced embed URL, or null if unsupported. */
export function toVideoEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (host === 'youtube.com') id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null;
    if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const vid = url.pathname.match(/(\d{5,12})/)?.[1];
      if (vid) return `https://player.vimeo.com/video/${vid}?dnt=1`;
    }
    return null;
  } catch {
    return null;
  }
}
