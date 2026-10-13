const TRANSLITERATIONS: Record<string, string> = {
  æ: 'ae',
  ø: 'o',
  å: 'a',
  ä: 'a',
  ö: 'o',
  ü: 'u',
  ß: 'ss',
  þ: 'th',
  ð: 'd',
  ł: 'l',
};

/** URL-safe slug: lowercase ascii, digits and single dashes. Returns '' when nothing usable remains. */
export function slugify(input: string, maxLength = 48): string {
  const lowered = input.toLowerCase().replace(/[æøåäöüßþðł]/g, (c) => TRANSLITERATIONS[c] ?? c);
  return lowered
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/** Reserved crew slugs / usernames that collide with routes or could be used for impersonation. */
export const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'c',
  'crew',
  'crews',
  'discover',
  'events',
  'garage',
  'help',
  'home',
  'invite',
  'legal',
  'login',
  'logout',
  'me',
  'messages',
  'moderator',
  'new',
  'notifications',
  'official',
  'onboarding',
  'privacy',
  'root',
  'security',
  'settings',
  'sign-in',
  'sign-up',
  'staff',
  'studio',
  'support',
  'system',
  'terms',
  'themes',
  'u',
  'v',
  'verification',
  'vogn',
  'vogn-team',
  'vogn_team',
  'www',
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle.toLowerCase());
}
