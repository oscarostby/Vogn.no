import type { WidgetDataByType, WidgetVehicle } from '@vogn/api-client';
import type { ThemePage, ThemePresetId } from '@vogn/theme-engine';
import type { EventSummary, UserSummary } from '@vogn/types';

/**
 * Illustrative sample content for marketing previews and the Studio playground.
 * Clearly fictional — never mixed with real data and never persisted.
 */

const hexId = (n: number) => n.toString(16).padStart(24, '0');

const people: UserSummary[] = [
  ['kaito', 'Kaito', '#FF2E88'],
  ['ingrid.r', 'Ingrid', '#00E5FF'],
  ['marco_e30', 'Marco', '#F2C14E'],
  ['dee', 'Dee', '#5FD38D'],
  ['lukas.v8', 'Lukas', '#FF5A1F'],
  ['saga', 'Saga', '#7B5CFF'],
  ['tomas', 'Tomas', '#C8FF5F'],
  ['aiko', 'Aiko', '#6CB6FF'],
].map(([username, displayName, accentColor], i) => ({
  id: hexId(1000 + i),
  username: username!,
  displayName: displayName!,
  avatar: null,
  accentColor: accentColor!,
  badges: i % 3 === 0 ? ['vehicle_specs_confirmed'] : [],
}));

const cars: [string, string, number, string | null, number | null][] = [
  ['Nissan', 'Skyline GT-R', 1999, 'Bayside Blue', 540],
  ['Toyota', 'Supra', 1997, 'Hachi', 620],
  ['Mazda', 'RX-7', 1993, null, 380],
  ['BMW', 'M3', 1989, 'E30 Evo', 238],
  ['Porsche', '911 Carrera', 1991, '964', 250],
  ['Ford', 'Mustang Boss 302', 1970, null, 290],
  ['Toyota', 'Land Cruiser', 1995, 'Troopy', 165],
  ['Land Rover', 'Defender 110', 2004, null, 122],
  ['Honda', 'NSX', 1992, null, 270],
  ['Chevrolet', 'Camaro Z28', 1969, 'Rally', 360],
];

const vehicles: WidgetVehicle[] = cars.map(([make, model, year, nickname, hp], i) => ({
  id: hexId(2000 + i),
  ownerId: people[i % people.length]!.id,
  owner: people[i % people.length]!,
  make,
  model,
  generation: null,
  year,
  trim: null,
  nickname,
  coverImage: null,
  currentHp: hp,
  visibility: 'public',
  verification: { specsConfirmed: i % 2 === 0, accessReviewed: false, ownershipEvidenceReviewed: false },
  likeCount: 12 + i * 7,
  updatedAt: new Date().toISOString(),
}));

function events(): EventSummary[] {
  const now = Date.now();
  const crew = { id: hexId(1), slug: 'sample', name: 'Sample crew', icon: null };
  return [
    ['Midnight run — harbour loop', 3, 'Oslo', 42],
    ['Track day: Rudskogen', 10, 'Rakkestad', 28],
    ['Sunday coffee & cars', 17, 'Bergen', 64],
    ['Overland weekend — Jotunheimen', 26, 'Lom', 17],
  ].map(([title, days, city, going], i) => ({
    id: hexId(3000 + i),
    crew,
    title: title as string,
    startsAt: new Date(now + (days as number) * 86_400_000 + 4 * 3_600_000).toISOString(),
    endsAt: null,
    timezone: 'Europe/Oslo',
    country: 'NO',
    city: city as string,
    coverImage: null,
    visibility: 'public',
    status: 'scheduled',
    goingCount: going as number,
    interestedCount: 9,
    rsvpLimit: null,
    viewerRsvp: null,
  }));
}

const posts = [
  'New exhaust is in — straight-pipe sound check video in #builds tonight.',
  'Reminder: meet point moved to the north lot. Quiet arrivals please.',
  'Anyone running coilovers on the stock arms? Looking for spring rates.',
  'Dyno day results are up. 520 hp at the wheels on pump fuel!',
];

export const SAMPLE_CREWS: Record<ThemePresetId, { name: string; description: string; region: string; country: string; category: string; members: number }> = {
  'tokyo-midnight': { name: 'Wangan Nights', description: 'Night runs and JDM builds.', region: 'Tokyo', country: 'JP', category: 'JDM', members: 1840 },
  'euro-atelier': { name: 'Atelier Classique', description: 'Considered European builds.', region: 'Stuttgart', country: 'DE', category: 'European cars', members: 612 },
  'american-iron': { name: 'Big Block Society', description: 'V8s, drag strips and cruise-ins.', region: 'Texas', country: 'US', category: 'American muscle', members: 2310 },
  'offroad-expedition': { name: 'Fjell & Grus Overland', description: 'Overlanding in the Nordics.', region: 'Innlandet', country: 'NO', category: 'Off-road', members: 438 },
  'vogn-minimal': { name: 'Oslo Car Collective', description: 'All makes, all ages, all welcome.', region: 'Oslo', country: 'NO', category: 'General automotive', members: 976 },
};

/** Builds sample widget data for every widget on a page. */
export function sampleWidgetData(page: ThemePage, members = 976): Record<string, unknown> {
  const ev = events();
  const data: Record<string, unknown> = {};
  const post = (i: number) => ({
    id: hexId(4000 + i),
    channelId: hexId(5000),
    channelName: ['general', 'builds', 'meets', 'tech'][i % 4]!,
    author: people[i % people.length]!,
    text: posts[i % posts.length]!,
    createdAt: new Date(Date.now() - (i + 1) * 3_600_000 * 5).toISOString(),
    replyCount: 3 + i * 2,
    reactionCount: 8 + i * 5,
  });
  for (const section of page.sections) {
    for (const w of section.widgets) {
      let value: WidgetDataByType[keyof WidgetDataByType] | undefined;
      switch (w.type) {
        case 'announcements':
        case 'popular_discussions':
          value = { items: [0, 1, 2].map(post) };
          break;
        case 'member_count':
          value = { members, online: Math.round(members * 0.08), avatars: people };
          break;
        case 'featured_member':
          value = { user: people[1]!, vehicle: vehicles[3]! };
          break;
        case 'featured_car':
          value = { vehicle: vehicles[0]! };
          break;
        case 'vehicle_gallery':
          value = { vehicles: vehicles.slice(0, Math.min(w.props.count, 8)) };
          break;
        case 'build_projects':
          value = {
            items: vehicles.slice(0, w.props.count).map((v, i) => ({
              vehicle: v,
              owner: v.owner,
              latestUpdate: {
                id: hexId(6000 + i),
                vehicleId: v.id,
                kind: 'modification' as const,
                title: ['Coilovers installed', 'Fresh paint correction', 'New turbo spooling', 'Interior retrim'][i % 4]!,
                body: null,
                occurredAt: new Date().toISOString(),
                media: [],
                before: null,
                after: null,
                cost: null,
                createdAt: new Date().toISOString(),
              },
            })),
          };
          break;
        case 'upcoming_meets':
          value = { events: ev.slice(0, w.props.count) };
          break;
        case 'event_calendar':
          value = { events: ev };
          break;
        case 'countdown':
          value = { event: ev[0]! };
          break;
        case 'poll':
          value = { pollKey: w.id, counts: w.props.options.map((_, i) => 12 - i * 3), total: w.props.options.reduce((s, _, i) => s + 12 - i * 3, 0), viewerChoice: null, closed: false };
          break;
        case 'leaderboard':
          value = { metric: w.props.metric, entries: people.slice(0, w.props.count).map((user, i) => ({ user, value: 420 - i * 47 })) };
          break;
        case 'channel_list':
          value = {
            channels: [
              { id: hexId(5000), name: 'general', type: 'text', topic: 'Say hi and introduce your car', icon: null },
              { id: hexId(5001), name: 'builds', type: 'showcase', topic: 'Progress, before & after', icon: 'wrench' },
              { id: hexId(5002), name: 'meets', type: 'event', topic: 'Plans and meet points', icon: 'map-pin' },
              { id: hexId(5003), name: 'garage-talk', type: 'voice', topic: null, icon: 'mic' },
            ],
          };
          break;
        case 'stats':
          value = { members, channels: 12, builds: 148, events: 36, founded: new Date('2021-04-01').toISOString() };
          break;
        default:
          break;
      }
      if (value) data[w.id] = value;
    }
  }
  return data;
}

export const SAMPLE_PEOPLE = people;
export const SAMPLE_VEHICLES = vehicles;
