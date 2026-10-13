import { THEME_SCHEMA_VERSION, type ThemeManifest, type ThemeSection } from './schema';
import { createWidget, type ThemeWidget, type WidgetOf, type WidgetType } from './widgets';

type WidgetOverrides<T extends WidgetType> = Partial<Omit<WidgetOf<T>, 'props' | 'type'>> & {
  props?: Partial<WidgetOf<T>['props']>;
};

function w<T extends WidgetType>(type: T, id: string, overrides: WidgetOverrides<T> = {}): ThemeWidget {
  const base = createWidget(type, id);
  return {
    ...base,
    ...overrides,
    span: { ...base.span, ...(overrides.span ?? {}) },
    props: { ...base.props, ...(overrides.props ?? {}) },
  } as ThemeWidget;
}

function section(id: string, widgets: ThemeWidget[], opts: Partial<Omit<ThemeSection, 'id' | 'widgets'>> = {}): ThemeSection {
  return {
    id,
    title: null,
    subtitle: null,
    background: 'none',
    padding: 'md',
    fullBleed: false,
    gap: 'md',
    widgets,
    ...opts,
  };
}

const span = (desktop: number, tablet = 12, mobile: 'full' | 'half' = 'full') => ({ desktop, tablet, mobile });

/* ------------------------------------------------------------------------ */
/* VOGN Minimal — neutral, accessibility-first default                       */
/* ------------------------------------------------------------------------ */

export const vognMinimal: ThemeManifest = {
  schemaVersion: THEME_SCHEMA_VERSION,
  meta: {
    name: 'VOGN Minimal',
    description: 'Clean, neutral and accessibility-first. A great base for any community.',
    presetId: 'vogn-minimal',
    tags: ['minimal', 'general', 'accessible'],
  },
  mode: 'dark',
  colors: {
    background: '#101114',
    surface: '#191B20',
    surfaceElevated: '#22252B',
    border: '#30333A',
    text: '#F5F5F6',
    textMuted: '#A4A8B2',
    primary: '#C8FF5F',
    primaryContrast: '#101114',
    secondary: '#2B2F36',
    accent: '#C8FF5F',
    success: '#5FD38D',
    warning: '#F2C14E',
    danger: '#FF6B6B',
  },
  altColors: {
    background: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E1E1DC',
    text: '#121316',
    textMuted: '#5B5F68',
    primary: '#121316',
    primaryContrast: '#FFFFFF',
    secondary: '#EFEFEC',
    accent: '#3F6212',
    success: '#1A7F4B',
    warning: '#9A6700',
    danger: '#C62828',
  },
  allowModeSwitch: true,
  typography: {
    heading: 'inter',
    body: 'inter',
    mono: 'jetbrains-mono',
    scale: 1,
    headingWeight: 700,
    headingCase: 'none',
    headingTracking: -0.02,
    bodyLineHeight: 1.55,
  },
  shape: { radius: 10, borderWidth: 1, density: 'comfortable', shadow: 'soft', iconStroke: 1.75 },
  background: {
    type: 'solid',
    color: '#101114',
    gradient: null,
    imageUrl: null,
    videoUrl: null,
    overlayColor: '#000000',
    overlayOpacity: 0,
    blur: 0,
    pattern: 'none',
    patternOpacity: 0,
    effect: 'none',
    effectIntensity: 0,
  },
  header: {
    style: 'banner',
    height: 'md',
    align: 'left',
    showIcon: true,
    showStats: true,
    overlayOpacity: 0.45,
    tagline: null,
    decorativeText: null,
    decorativeStyle: 'none',
  },
  components: {
    button: 'solid',
    card: 'outlined',
    input: 'filled',
    channelList: 'compact',
    messageStyle: 'cozy',
    avatarShape: 'circle',
    badge: 'pill',
    divider: 'line',
  },
  layout: {
    desktop: { navigation: 'sidebar-left', sidebarWidth: 248, contentWidth: 'normal', showMemberList: true },
    tablet: { navigation: 'drawer' },
    mobile: { navigation: 'tabs', compactHeader: false },
  },
  pages: [
    {
      id: 'home',
      slug: 'home',
      title: 'Home',
      icon: 'home',
      showInNav: true,
      sections: [
        section('intro', [w('welcome', 'welcome')]),
        section('updates', [
          w('announcements', 'announcements', { span: span(6) }),
          w('upcoming_meets', 'meets', { span: span(6) }),
        ]),
        section('community', [
          w('channel_list', 'channels', { span: span(4, 6) }),
          w('build_projects', 'builds', { span: span(8, 6) }),
        ]),
      ],
    },
  ],
  navigation: [
    { id: 'nav-home', label: 'Home', icon: 'home', target: { kind: 'page', pageId: 'home' } },
    { id: 'nav-events', label: 'Events', icon: 'calendar', target: { kind: 'events' } },
    { id: 'nav-members', label: 'Members', icon: 'users', target: { kind: 'members' } },
  ],
  channelOverrides: {},
  roleStyles: {},
  motion: { preset: 'subtle', hoverLift: false, pageTransition: 'fade' },
};

/* ------------------------------------------------------------------------ */
/* Tokyo Midnight — JDM night culture                                        */
/* ------------------------------------------------------------------------ */

export const tokyoMidnight: ThemeManifest = {
  schemaVersion: THEME_SCHEMA_VERSION,
  meta: {
    name: 'Tokyo Midnight',
    description: 'Night runs, neon reflections and Japanese street culture. Built for JDM crews.',
    presetId: 'tokyo-midnight',
    tags: ['jdm', 'night', 'neon', 'japan'],
  },
  mode: 'dark',
  colors: {
    background: '#0A0612',
    surface: '#130C22',
    surfaceElevated: '#1C1332',
    border: '#2D2050',
    text: '#F4EFFF',
    textMuted: '#A99CC8',
    primary: '#FF2E88',
    primaryContrast: '#0A0612',
    secondary: '#7B5CFF',
    accent: '#00E5FF',
    success: '#3DFFB0',
    warning: '#FFD166',
    danger: '#FF4D6D',
  },
  altColors: null,
  allowModeSwitch: false,
  typography: {
    heading: 'zen-kaku-gothic-new',
    body: 'noto-sans-jp',
    mono: 'jetbrains-mono',
    scale: 1.05,
    headingWeight: 900,
    headingCase: 'uppercase',
    headingTracking: 0.06,
    bodyLineHeight: 1.6,
  },
  shape: { radius: 3, borderWidth: 1, density: 'comfortable', shadow: 'glow', iconStroke: 1.5 },
  background: {
    type: 'gradient',
    color: '#0A0612',
    gradient: {
      kind: 'radial',
      angle: 180,
      stops: [
        { color: '#2A0F4A', position: 0 },
        { color: '#120A24', position: 45 },
        { color: '#0A0612', position: 100 },
      ],
    },
    imageUrl: null,
    videoUrl: null,
    overlayColor: '#0A0612',
    overlayOpacity: 0.35,
    blur: 0,
    pattern: 'scanlines',
    patternOpacity: 0.07,
    effect: 'neon-grid',
    effectIntensity: 0.65,
  },
  header: {
    style: 'fullbleed',
    height: 'xl',
    align: 'left',
    showIcon: true,
    showStats: true,
    overlayOpacity: 0.55,
    tagline: 'Night runs. Wangan dreams. Street culture after dark.',
    decorativeText: '東京ミッドナイト',
    decorativeStyle: 'vertical',
  },
  components: {
    button: 'glow',
    card: 'outlined',
    input: 'underline',
    channelList: 'icons',
    messageStyle: 'compact',
    avatarShape: 'square',
    badge: 'tag',
    divider: 'gradient',
  },
  layout: {
    desktop: { navigation: 'sidebar-left', sidebarWidth: 264, contentWidth: 'wide', showMemberList: true },
    tablet: { navigation: 'drawer' },
    mobile: { navigation: 'tabs', compactHeader: true },
  },
  pages: [
    {
      id: 'home',
      slug: 'home',
      title: 'ホーム Home',
      icon: 'home',
      showInNav: true,
      sections: [
        section('hero', [
          w('welcome', 'welcome', {
            props: {
              eyebrow: '夜 · NIGHT CREW',
              heading: 'After midnight, the city is ours',
              body: 'Touge mornings, Daikoku nights and late-night garage sessions. Share your build, plan the next run and keep it respectful on the street.',
              align: 'left',
            },
          }),
        ], { padding: 'lg' }),
        section(
          'tonight',
          [
            w('countdown', 'countdown', { span: span(4, 6), props: { label: 'Next night run' } }),
            w('member_count', 'members', { span: span(4, 6, 'half'), props: { label: 'Crew online', display: 'avatars' } }),
            w('upcoming_meets', 'meets', { span: span(4, 12), props: { layout: 'ticket', count: 2 } }),
          ],
          { title: 'Tonight', subtitle: '今夜の予定', background: 'surface' },
        ),
        section(
          'garage',
          [w('vehicle_gallery', 'gallery', { props: { layout: 'mosaic', count: 10 }, title: 'Night garage' })],
          { title: 'ガレージ Garage', fullBleed: true },
        ),
        section('talk', [
          w('popular_discussions', 'trending', { span: span(7) }),
          w('leaderboard', 'leaders', { span: span(5), props: { metric: 'reactions', period: '30d' } }),
        ]),
      ],
    },
    {
      id: 'garage',
      slug: 'garage',
      title: 'Garage',
      icon: 'car-front',
      showInNav: true,
      sections: [
        section('builds', [
          w('featured_car', 'featured', { span: span(7) }),
          w('build_projects', 'projects', { span: span(5), props: { count: 5 } }),
        ]),
        section('all', [w('vehicle_gallery', 'all-cars', { props: { layout: 'grid', count: 24 } })]),
      ],
    },
    {
      id: 'meets',
      slug: 'meets',
      title: 'Meets',
      icon: 'map-pin',
      showInNav: true,
      sections: [
        section('calendar', [
          w('event_calendar', 'calendar', { span: span(7) }),
          w('upcoming_meets', 'meet-list', { span: span(5), props: { layout: 'ticket', count: 5 } }),
        ]),
        section('etiquette', [
          w('rules', 'etiquette', {
            title: 'Meet etiquette',
            props: {
              source: 'custom',
              numbered: true,
              items: [
                'No burnouts, no revving in residential areas.',
                'Leave every spot cleaner than we found it.',
                'Respect the locals and other road users.',
                'Photos of plates or faces only with consent.',
              ],
            },
          }),
        ]),
      ],
    },
  ],
  navigation: [
    { id: 'nav-home', label: 'Home', icon: 'home', target: { kind: 'page', pageId: 'home' } },
    { id: 'nav-garage', label: 'Garage', icon: 'car-front', target: { kind: 'page', pageId: 'garage' } },
    { id: 'nav-meets', label: 'Meets', icon: 'map-pin', target: { kind: 'page', pageId: 'meets' } },
    { id: 'nav-members', label: 'Crew', icon: 'users', target: { kind: 'members' } },
  ],
  channelOverrides: {},
  roleStyles: {},
  motion: { preset: 'energetic', hoverLift: true, pageTransition: 'slide' },
};

/* ------------------------------------------------------------------------ */
/* Euro Atelier — European luxury, editorial                                  */
/* ------------------------------------------------------------------------ */

export const euroAtelier: ThemeManifest = {
  schemaVersion: THEME_SCHEMA_VERSION,
  meta: {
    name: 'Euro Atelier',
    description: 'An editorial, gallery-like space for European builds and photography.',
    presetId: 'euro-atelier',
    tags: ['european', 'editorial', 'luxury', 'photography'],
  },
  mode: 'light',
  colors: {
    background: '#F6F3EE',
    surface: '#FFFFFF',
    surfaceElevated: '#FBFAF7',
    border: '#E2DCD0',
    text: '#1B1A17',
    textMuted: '#6A6458',
    primary: '#1B1A17',
    primaryContrast: '#FFFFFF',
    secondary: '#E9E3D7',
    accent: '#8C5A22',
    success: '#2F6B3B',
    warning: '#8A6100',
    danger: '#9B2C2C',
  },
  altColors: {
    background: '#141311',
    surface: '#1C1A17',
    surfaceElevated: '#24221E',
    border: '#38342D',
    text: '#F3EFE7',
    textMuted: '#B0A898',
    primary: '#F3EFE7',
    primaryContrast: '#141311',
    secondary: '#2B2823',
    accent: '#D9A25F',
    success: '#7CC48A',
    warning: '#E2B55A',
    danger: '#E07A7A',
  },
  allowModeSwitch: true,
  typography: {
    heading: 'playfair-display',
    body: 'manrope',
    mono: 'ibm-plex-mono',
    scale: 1.08,
    headingWeight: 600,
    headingCase: 'none',
    headingTracking: -0.02,
    bodyLineHeight: 1.75,
  },
  shape: { radius: 0, borderWidth: 1, density: 'spacious', shadow: 'none', iconStroke: 1.25 },
  background: {
    type: 'solid',
    color: '#F6F3EE',
    gradient: null,
    imageUrl: null,
    videoUrl: null,
    overlayColor: '#000000',
    overlayOpacity: 0,
    blur: 0,
    pattern: 'none',
    patternOpacity: 0,
    effect: 'none',
    effectIntensity: 0,
  },
  header: {
    style: 'editorial',
    height: 'lg',
    align: 'center',
    showIcon: false,
    showStats: false,
    overlayOpacity: 0.2,
    tagline: 'Precision, provenance and the art of the European build.',
    decorativeText: 'No. 01',
    decorativeStyle: 'outline',
  },
  components: {
    button: 'sharp',
    card: 'editorial',
    input: 'underline',
    channelList: 'comfortable',
    messageStyle: 'cozy',
    avatarShape: 'circle',
    badge: 'chip',
    divider: 'line',
  },
  layout: {
    desktop: { navigation: 'top', sidebarWidth: 240, contentWidth: 'normal', showMemberList: false },
    tablet: { navigation: 'top' },
    mobile: { navigation: 'top', compactHeader: false },
  },
  pages: [
    {
      id: 'home',
      slug: 'home',
      title: 'Atelier',
      icon: 'home',
      showInNav: true,
      sections: [
        section(
          'intro',
          [
            w('rich_text', 'intro', {
              props: {
                markdown:
                  '## A quiet place for considered builds\n\nOEM+ details, period-correct restorations and the photography that does them justice. Share the story behind every part.',
                align: 'center',
                size: 'lg',
              },
            }),
          ],
          { padding: 'lg' },
        ),
        section(
          'feature',
          [
            w('featured_car', 'feature', { span: span(8), props: { showSpecs: true } }),
            w('stats', 'numbers', { span: span(4), props: { items: ['members', 'builds', 'founded'] } }),
          ],
          { title: 'The feature', subtitle: 'Selected by the curators', gap: 'lg' },
        ),
        section('journal', [
          w('build_projects', 'journal', { span: span(6), title: 'From the workshop', props: { count: 4 } }),
          w('upcoming_meets', 'gatherings', { span: span(6), title: 'Gatherings', props: { layout: 'list' } }),
        ]),
        section('gallery', [w('image_gallery', 'gallery', { title: 'Photography', props: { layout: 'grid' } })], {
          background: 'surface',
          fullBleed: true,
        }),
      ],
    },
    {
      id: 'collection',
      slug: 'collection',
      title: 'Collection',
      icon: 'gem',
      showInNav: true,
      sections: [section('cars', [w('vehicle_gallery', 'collection', { props: { layout: 'grid', count: 18 } })])],
    },
    {
      id: 'journal',
      slug: 'journal',
      title: 'Journal',
      icon: 'book-open',
      showInNav: true,
      sections: [
        section('posts', [
          w('announcements', 'notes', { span: span(7), title: 'Editor’s notes' }),
          w('popular_discussions', 'conversation', { span: span(5), title: 'In conversation' }),
        ]),
      ],
    },
  ],
  navigation: [
    { id: 'nav-home', label: 'Atelier', icon: 'home', target: { kind: 'page', pageId: 'home' } },
    { id: 'nav-collection', label: 'Collection', icon: 'gem', target: { kind: 'page', pageId: 'collection' } },
    { id: 'nav-journal', label: 'Journal', icon: 'book-open', target: { kind: 'page', pageId: 'journal' } },
    { id: 'nav-events', label: 'Gatherings', icon: 'calendar', target: { kind: 'events' } },
  ],
  channelOverrides: {},
  roleStyles: {},
  motion: { preset: 'smooth', hoverLift: false, pageTransition: 'fade' },
};

/* ------------------------------------------------------------------------ */
/* American Iron — muscle culture                                             */
/* ------------------------------------------------------------------------ */

export const americanIron: ThemeManifest = {
  schemaVersion: THEME_SCHEMA_VERSION,
  meta: {
    name: 'American Iron',
    description: 'Industrial steel, warm orange and bold type for muscle and hot-rod crews.',
    presetId: 'american-iron',
    tags: ['muscle', 'v8', 'industrial', 'events'],
  },
  mode: 'dark',
  colors: {
    background: '#121010',
    surface: '#1C1816',
    surfaceElevated: '#27201D',
    border: '#3D322D',
    text: '#F5EEE8',
    textMuted: '#B8AAA0',
    primary: '#FF5A1F',
    primaryContrast: '#121010',
    secondary: '#B3122B',
    accent: '#FFB000',
    success: '#7BCB6A',
    warning: '#FFB000',
    danger: '#FF5A5A',
  },
  altColors: null,
  allowModeSwitch: false,
  typography: {
    heading: 'bebas-neue',
    body: 'archivo',
    mono: 'ibm-plex-mono',
    scale: 1.2,
    headingWeight: 400,
    headingCase: 'uppercase',
    headingTracking: 0.04,
    bodyLineHeight: 1.55,
  },
  shape: { radius: 2, borderWidth: 2, density: 'comfortable', shadow: 'hard', iconStroke: 2.25 },
  background: {
    type: 'solid',
    color: '#121010',
    gradient: null,
    imageUrl: null,
    videoUrl: null,
    overlayColor: '#000000',
    overlayOpacity: 0.2,
    blur: 0,
    pattern: 'diagonal',
    patternOpacity: 0.05,
    effect: 'heat-haze',
    effectIntensity: 0.35,
  },
  header: {
    style: 'plate',
    height: 'lg',
    align: 'left',
    showIcon: true,
    showStats: true,
    overlayOpacity: 0.5,
    tagline: 'Cubic inches, burnouts at the strip and Friday night cruise-ins.',
    decorativeText: 'EST. V8',
    decorativeStyle: 'stamp',
  },
  components: {
    button: 'sharp',
    card: 'brutal',
    input: 'filled',
    channelList: 'cards',
    messageStyle: 'cozy',
    avatarShape: 'square',
    badge: 'tag',
    divider: 'dashed',
  },
  layout: {
    desktop: { navigation: 'sidebar-right', sidebarWidth: 280, contentWidth: 'wide', showMemberList: false },
    tablet: { navigation: 'top' },
    mobile: { navigation: 'drawer', compactHeader: false },
  },
  pages: [
    {
      id: 'home',
      slug: 'home',
      title: 'Shop',
      icon: 'home',
      showInNav: true,
      sections: [
        section('hero', [
          w('welcome', 'welcome', {
            props: {
              eyebrow: 'Cruise night every Friday',
              heading: 'Built, not bought',
              body: 'Small blocks, big blocks, LS swaps and everything in between. Bring your project, bring your stories.',
            },
          }),
        ]),
        section('numbers', [w('stats', 'stats', { props: { items: ['members', 'builds', 'events', 'founded'] } })], {
          background: 'elevated',
          padding: 'sm',
        }),
        section(
          'events',
          [
            w('upcoming_meets', 'meets', { span: span(8), props: { layout: 'cards', count: 3 } }),
            w('countdown', 'countdown', { span: span(4), props: { label: 'Next cruise-in' } }),
          ],
          { title: 'On the calendar' },
        ),
        section('shop', [
          w('build_projects', 'builds', { span: span(6), title: 'In the shop', props: { sort: 'popular' } }),
          w('leaderboard', 'leaders', { span: span(6), title: 'Most horsepower talk', props: { metric: 'messages' } }),
        ]),
        section('lot', [w('vehicle_gallery', 'lot', { title: 'The lot', props: { layout: 'carousel', count: 12 } })]),
      ],
    },
    {
      id: 'events',
      slug: 'events',
      title: 'Cruise-ins',
      icon: 'flag',
      showInNav: true,
      sections: [
        section('calendar', [
          w('event_calendar', 'calendar', { span: span(6), props: { months: 2 } }),
          w('upcoming_meets', 'list', { span: span(6), props: { layout: 'cards', count: 6 } }),
        ]),
      ],
    },
  ],
  navigation: [
    { id: 'nav-home', label: 'Shop', icon: 'home', target: { kind: 'page', pageId: 'home' } },
    { id: 'nav-events', label: 'Cruise-ins', icon: 'flag', target: { kind: 'page', pageId: 'events' } },
    { id: 'nav-members', label: 'Members', icon: 'users', target: { kind: 'members' } },
  ],
  channelOverrides: {},
  roleStyles: {},
  motion: { preset: 'smooth', hoverLift: true, pageTransition: 'slide' },
};

/* ------------------------------------------------------------------------ */
/* Offroad Expedition — earth tones, rugged                                   */
/* ------------------------------------------------------------------------ */

export const offroadExpedition: ThemeManifest = {
  schemaVersion: THEME_SCHEMA_VERSION,
  meta: {
    name: 'Offroad Expedition',
    description: 'Earth tones, topographic textures and trip logs for overlanders and trail crews.',
    presetId: 'offroad-expedition',
    tags: ['offroad', 'overland', 'outdoors', 'trips'],
  },
  mode: 'light',
  colors: {
    background: '#EEE7DA',
    surface: '#F8F3EA',
    surfaceElevated: '#FFFDF8',
    border: '#D2C3AA',
    text: '#2A241C',
    textMuted: '#6B5D49',
    primary: '#4B652B',
    primaryContrast: '#FFFFFF',
    secondary: '#9E4F2A',
    accent: '#A8621E',
    success: '#3F7A3A',
    warning: '#94600B',
    danger: '#A33A2B',
  },
  altColors: {
    background: '#1A1814',
    surface: '#23201B',
    surfaceElevated: '#2D2922',
    border: '#433C31',
    text: '#F1EADD',
    textMuted: '#B8AA92',
    primary: '#9CC062',
    primaryContrast: '#1A1814',
    secondary: '#D27A4C',
    accent: '#E0A458',
    success: '#8FCB7E',
    warning: '#E5B24E',
    danger: '#E07A66',
  },
  allowModeSwitch: true,
  typography: {
    heading: 'barlow-condensed',
    body: 'archivo',
    mono: 'ibm-plex-mono',
    scale: 1.08,
    headingWeight: 700,
    headingCase: 'uppercase',
    headingTracking: 0.02,
    bodyLineHeight: 1.6,
  },
  shape: { radius: 10, borderWidth: 2, density: 'comfortable', shadow: 'soft', iconStroke: 2 },
  background: {
    type: 'solid',
    color: '#EEE7DA',
    gradient: null,
    imageUrl: null,
    videoUrl: null,
    overlayColor: '#2A241C',
    overlayOpacity: 0,
    blur: 0,
    pattern: 'topographic',
    patternOpacity: 0.14,
    effect: 'dust',
    effectIntensity: 0.25,
  },
  header: {
    style: 'split',
    height: 'lg',
    align: 'left',
    showIcon: true,
    showStats: true,
    overlayOpacity: 0.3,
    tagline: 'Trails, recovery gear and expeditions beyond the tarmac.',
    decorativeText: 'N 61° E 08°',
    decorativeStyle: 'stamp',
  },
  components: {
    button: 'solid',
    card: 'outlined',
    input: 'outlined',
    channelList: 'comfortable',
    messageStyle: 'cozy',
    avatarShape: 'rounded',
    badge: 'chip',
    divider: 'dashed',
  },
  layout: {
    desktop: { navigation: 'sidebar-left', sidebarWidth: 280, contentWidth: 'normal', showMemberList: true },
    tablet: { navigation: 'drawer' },
    mobile: { navigation: 'tabs', compactHeader: false },
  },
  pages: [
    {
      id: 'home',
      slug: 'home',
      title: 'Basecamp',
      icon: 'tent',
      showInNav: true,
      sections: [
        section('intro', [
          w('welcome', 'welcome', {
            span: span(8),
            props: {
              eyebrow: 'Basecamp',
              heading: 'Air down. Head out.',
              body: 'Plan trips, share recovery tips and log every expedition. Tread lightly — leave no trace.',
            },
          }),
          w('member_count', 'members', { span: span(4, 12), props: { label: 'Explorers', display: 'big-number' } }),
        ]),
        section('log', [w('image_gallery', 'expedition-log', { title: 'Expedition log', props: { layout: 'mosaic' } })], {
          background: 'surface',
        }),
        section('trips', [
          w('upcoming_meets', 'trips', { span: span(7), title: 'Upcoming trips', props: { layout: 'cards' } }),
          w('event_calendar', 'calendar', { span: span(5), title: 'Trail calendar' }),
        ]),
        section('resources', [
          w('links', 'resources', {
            span: span(5),
            title: 'Trail resources',
            props: { layout: 'tiles', links: [] },
          }),
          w('rules', 'trail-rules', {
            span: span(7),
            title: 'Trail code',
            props: {
              source: 'custom',
              numbered: false,
              items: [
                'Stay on marked trails and respect closures.',
                'Never wheel alone — minimum two vehicles.',
                'Carry recovery points, a strap and a first-aid kit.',
                'Pack it in, pack it out.',
              ],
            },
          }),
        ]),
      ],
    },
    {
      id: 'rigs',
      slug: 'rigs',
      title: 'Rigs',
      icon: 'mountain',
      showInNav: true,
      sections: [
        section('rigs', [
          w('vehicle_gallery', 'rigs', { props: { layout: 'grid', count: 16 } }),
          w('build_projects', 'builds', { props: { count: 6 } }),
        ]),
      ],
    },
  ],
  navigation: [
    { id: 'nav-home', label: 'Basecamp', icon: 'tent', target: { kind: 'page', pageId: 'home' } },
    { id: 'nav-rigs', label: 'Rigs', icon: 'mountain', target: { kind: 'page', pageId: 'rigs' } },
    { id: 'nav-events', label: 'Trips', icon: 'compass', target: { kind: 'events' } },
    { id: 'nav-members', label: 'Explorers', icon: 'users', target: { kind: 'members' } },
  ],
  channelOverrides: {},
  roleStyles: {},
  motion: { preset: 'subtle', hoverLift: true, pageTransition: 'fade' },
};

export const THEME_PRESETS = {
  'vogn-minimal': vognMinimal,
  'tokyo-midnight': tokyoMidnight,
  'euro-atelier': euroAtelier,
  'american-iron': americanIron,
  'offroad-expedition': offroadExpedition,
} as const satisfies Record<string, ThemeManifest>;

export type ThemePresetId = keyof typeof THEME_PRESETS;
export const THEME_PRESET_IDS = Object.keys(THEME_PRESETS) as ThemePresetId[];
export const DEFAULT_THEME: ThemeManifest = vognMinimal;

export function isPresetId(value: string): value is ThemePresetId {
  return value in THEME_PRESETS;
}

/** Deep copy of a preset so callers can mutate safely. */
export function presetManifest(id: string): ThemeManifest {
  const preset = isPresetId(id) ? THEME_PRESETS[id] : DEFAULT_THEME;
  return structuredClone(preset);
}
