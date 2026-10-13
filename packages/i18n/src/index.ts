import da from '../messages/da.json';
import de from '../messages/de.json';
import en from '../messages/en.json';
import ja from '../messages/ja.json';
import nb from '../messages/nb.json';
import sv from '../messages/sv.json';

export const SUPPORTED_LOCALES = ['en', 'nb', 'sv', 'da', 'de', 'ja'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const FALLBACK_LOCALE: SupportedLocale = 'en';

export const LOCALE_LABELS: Record<SupportedLocale, { native: string; english: string; dir: 'ltr' | 'rtl' }> = {
  en: { native: 'English', english: 'English', dir: 'ltr' },
  nb: { native: 'Norsk bokmål', english: 'Norwegian', dir: 'ltr' },
  sv: { native: 'Svenska', english: 'Swedish', dir: 'ltr' },
  da: { native: 'Dansk', english: 'Danish', dir: 'ltr' },
  de: { native: 'Deutsch', english: 'German', dir: 'ltr' },
  ja: { native: '日本語', english: 'Japanese', dir: 'ltr' },
};

export type Messages = typeof en;
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const CATALOGUES: Record<SupportedLocale, Record<string, Json>> = { en, nb, sv, da, de, ja };

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function deepMerge(base: Record<string, Json>, override: Record<string, Json>): Record<string, Json> {
  const out: Record<string, Json> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
      out[key] = deepMerge(current as Record<string, Json>, value as Record<string, Json>);
    } else if (value !== '' && value !== null) {
      out[key] = value;
    }
  }
  return out;
}

const merged = new Map<SupportedLocale, Messages>();

/** Messages for a locale with key-by-key English fallback. */
export function getMessages(locale: SupportedLocale): Messages {
  const hit = merged.get(locale);
  if (hit) return hit;
  const result = (locale === FALLBACK_LOCALE ? en : deepMerge(en as Record<string, Json>, CATALOGUES[locale])) as Messages;
  merged.set(locale, result);
  return result;
}

/** Picks the best supported locale from an Accept-Language header or a list of preferences. */
export function negotiateLocale(preferences: string | readonly string[] | null | undefined): SupportedLocale {
  if (!preferences) return FALLBACK_LOCALE;
  const list =
    typeof preferences === 'string'
      ? preferences
          .split(',')
          .map((part) => {
            const [tag, q] = part.trim().split(';q=');
            return { tag: (tag ?? '').toLowerCase(), q: q ? Number(q) : 1 };
          })
          .sort((a, b) => b.q - a.q)
          .map((p) => p.tag)
      : preferences.map((p) => p.toLowerCase());
  for (const tag of list) {
    const base = tag.split('-')[0] ?? '';
    if (base === 'no' || base === 'nn' || base === 'nb') return 'nb';
    if (isSupportedLocale(base)) return base;
  }
  return FALLBACK_LOCALE;
}

/**
 * Tiny ICU-subset formatter for non-React contexts (mobile, emails, push): `{name}` placeholders and
 * `{count, plural, one {# item} other {# items}}`. Dot-path keys; unknown keys return the key.
 */
export function translate(
  messages: Messages,
  key: string,
  values?: Record<string, string | number>,
  locale: SupportedLocale = FALLBACK_LOCALE,
): string {
  const raw = key
    .split('.')
    .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages);
  if (typeof raw !== 'string') return key;
  if (!values) return raw;
  const plural = raw.replace(
    /\{(\w+),\s*plural,\s*((?:[^{}]*\{[^{}]*\})+)\s*\}/g,
    (_, name: string, body: string) => {
      const n = Number(values[name] ?? 0);
      const forms = Object.fromEntries([...body.matchAll(/(=?\w+)\s*\{([^{}]*)\}/g)].map((m) => [m[1], m[2]]));
      const category = new Intl.PluralRules(locale).select(n);
      const form = forms[`=${n}`] ?? forms[category] ?? forms.other ?? '';
      return form.replace(/#/g, new Intl.NumberFormat(locale).format(n));
    },
  );
  return plural.replace(/\{(\w+)\}/g, (_, name: string) => (name in values ? String(values[name]) : `{${name}}`));
}
