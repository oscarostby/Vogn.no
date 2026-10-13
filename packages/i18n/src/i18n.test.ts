import { describe, expect, it } from 'vitest';
import da from '../messages/da.json';
import de from '../messages/de.json';
import ja from '../messages/ja.json';
import nb from '../messages/nb.json';
import sv from '../messages/sv.json';
import { getMessages, negotiateLocale, translate } from './index';

describe('i18n', () => {
  it('falls back to English key by key', () => {
    const nb = getMessages('nb');
    expect(nb.nav.home).toBe('Hjem');
    expect(nb.studio.title).toBe('Crew Studio');
  });

  it('negotiates locales from Accept-Language', () => {
    expect(negotiateLocale('nb-NO,nb;q=0.9,en;q=0.8')).toBe('nb');
    expect(negotiateLocale('no')).toBe('nb');
    expect(negotiateLocale('fr-FR,de;q=0.7')).toBe('de');
    expect(negotiateLocale('fr-FR')).toBe('en');
    expect(negotiateLocale(null)).toBe('en');
  });

  it('formats placeholders and plurals', () => {
    const en = getMessages('en');
    expect(translate(en, 'home.greeting', { name: 'Kai' })).toBe('Welcome back, Kai');
    expect(translate(en, 'crews.members', { count: 1 })).toBe('1 member');
    expect(translate(en, 'crews.members', { count: 1200 })).toBe('1,200 members');
    expect(translate(en, 'missing.key')).toBe('missing.key');
  });

  it('every locale catalogue only uses keys that exist in English', () => {
    const en = getMessages('en') as unknown as Record<string, unknown>;
    const check = (node: Record<string, unknown>, ref: Record<string, unknown>, path: string) => {
      for (const [k, v] of Object.entries(node)) {
        expect(ref, `${path}${k}`).toHaveProperty(k);
        if (v && typeof v === 'object') check(v as Record<string, unknown>, ref[k] as Record<string, unknown>, `${path}${k}.`);
      }
    };
    for (const [locale, raw] of Object.entries({ nb, sv, da, de, ja })) {
      check(raw as Record<string, unknown>, en, `${locale}:`);
    }
  });
});
