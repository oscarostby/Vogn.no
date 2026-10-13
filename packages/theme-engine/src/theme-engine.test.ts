import { contrastRatio } from '@vogn/utils';
import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  backgroundStyle,
  createWidget,
  DEFAULT_THEME,
  parseThemeManifest,
  presetManifest,
  resolveTheme,
  safeManifest,
  sanitizeForMarketplace,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  themeCssVariables,
  toVideoEmbedUrl,
  WIDGET_DEFINITIONS,
  WIDGET_TYPES,
} from './index';

describe('presets', () => {
  it.each(THEME_PRESET_IDS)('%s validates against the strict schema', (id) => {
    const result = parseThemeManifest(THEME_PRESETS[id]);
    if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
    expect(result.ok).toBe(true);
  });

  it('presets are visually distinct beyond accent colour', () => {
    const fingerprints = THEME_PRESET_IDS.map((id) => {
      const p = THEME_PRESETS[id];
      return [p.typography.heading, p.components.card, p.header.style, p.layout.desktop.navigation, p.background.pattern].join('|');
    });
    expect(new Set(fingerprints).size).toBe(THEME_PRESET_IDS.length);
  });

  it('resolved presets meet text contrast requirements', () => {
    for (const id of THEME_PRESET_IDS) {
      const t = resolveTheme(THEME_PRESETS[id]);
      expect(contrastRatio(t.colors.text, t.colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.colors.textMuted, t.colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.colors.primaryContrast, t.colors.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.colors.accentText, t.colors.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('schema safety', () => {
  it('rejects unknown keys (no arbitrary CSS/HTML smuggling)', () => {
    const bad = { ...presetManifest('vogn-minimal'), customCss: 'body{display:none}' };
    expect(parseThemeManifest(bad).ok).toBe(false);
  });

  it('rejects non-hex colours', () => {
    const m = presetManifest('vogn-minimal');
    (m.colors as Record<string, string>).primary = 'red; background:url(javascript:alert(1))';
    expect(parseThemeManifest(m).ok).toBe(false);
  });

  it('rejects media from non-allowlisted hosts', () => {
    const m = presetManifest('vogn-minimal');
    m.background.type = 'image';
    m.background.imageUrl = 'https://evil.example.com/x.png';
    expect(parseThemeManifest(m).ok).toBe(false);
  });

  it('rejects non-https links in widgets', () => {
    const m = presetManifest('vogn-minimal');
    const links = createWidget('links', 'links-1');
    links.props.links = [{ label: 'x', url: 'javascript:alert(1)', icon: null }];
    m.pages[0]!.sections[0]!.widgets.push(links);
    expect(parseThemeManifest(m).ok).toBe(false);
  });

  it('requires a home page and unique widget ids', () => {
    const m = presetManifest('vogn-minimal');
    m.pages[0]!.slug = 'start';
    expect(parseThemeManifest(m).ok).toBe(false);

    const dup = presetManifest('vogn-minimal');
    const first = dup.pages[0]!.sections[0]!.widgets[0]!;
    dup.pages[0]!.sections[1]!.widgets.push({ ...first });
    expect(parseThemeManifest(dup).ok).toBe(false);
  });

  it('falls back to the default theme when invalid', () => {
    const { manifest, fellBack } = safeManifest({ nope: true });
    expect(fellBack).toBe(true);
    expect(manifest.meta.presetId).toBe(DEFAULT_THEME.meta.presetId);
  });
});

describe('resolver', () => {
  it('repairs low-contrast palettes', () => {
    const m = presetManifest('vogn-minimal');
    m.colors.text = '#1A1B1E';
    const t = resolveTheme(m);
    expect(contrastRatio(t.colors.text, t.colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(t.corrections.length).toBeGreaterThan(0);
  });

  it('switches to the alternate palette only when allowed', () => {
    expect(resolveTheme(presetManifest('vogn-minimal'), { mode: 'light' }).mode).toBe('light');
    expect(resolveTheme(presetManifest('tokyo-midnight'), { mode: 'light' }).mode).toBe('dark');
  });

  it('disables effects for reduced motion', () => {
    const t = resolveTheme(presetManifest('tokyo-midnight'), { reducedMotion: true });
    expect(t.effectsEnabled).toBe(false);
  });

  it('produces css variables and backgrounds', () => {
    const t = resolveTheme(presetManifest('offroad-expedition'));
    const vars = themeCssVariables(t);
    expect(vars['--ct-bg']).toMatch(/^#/);
    expect(backgroundStyle(t).background).toContain('data:image/svg+xml');
  });
});

describe('marketplace', () => {
  it('strips crew-specific references', () => {
    const m = presetManifest('tokyo-midnight');
    const featured = createWidget('featured_member', 'fm');
    featured.props.userId = 'a'.repeat(24);
    m.pages[0]!.sections[0]!.widgets.push(featured);
    m.channelOverrides['b'.repeat(24)] = { accent: '#FFFFFF', icon: 'hash', tint: false };
    const clean = sanitizeForMarketplace(m);
    expect(Object.keys(clean.channelOverrides)).toHaveLength(0);
    const fm = clean.pages[0]!.sections[0]!.widgets.find((x) => x.id === 'fm');
    expect(fm && fm.type === 'featured_member' && fm.props.userId).toBeNull();
    expect(parseThemeManifest(clean).ok).toBe(true);
  });

  it('style install keeps pages, full install replaces them', () => {
    const target = presetManifest('vogn-minimal');
    const source = presetManifest('euro-atelier');
    const style = applyTheme(target, source, 'style');
    expect(style.pages).toEqual(target.pages);
    expect(style.typography.heading).toBe('playfair-display');
    const full = applyTheme(target, source, 'full');
    expect(full.pages.map((p) => p.slug)).toContain('collection');
  });
});

describe('widgets', () => {
  it('every widget type has a definition whose defaults validate', () => {
    const m = presetManifest('vogn-minimal');
    m.pages[0]!.sections = [
      { id: 's', title: null, subtitle: null, background: 'none', padding: 'md', fullBleed: false, gap: 'md', widgets: [] },
    ];
    for (const type of WIDGET_TYPES) {
      expect(WIDGET_DEFINITIONS[type]).toBeDefined();
      m.pages[0]!.sections[0]!.widgets = [createWidget(type, `w-${type}`)];
      const result = parseThemeManifest(m);
      if (!result.ok) throw new Error(`${type}: ${JSON.stringify(result.issues)}`);
    }
  });

  it('builds privacy-enhanced embed urls', () => {
    expect(toVideoEmbedUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe(
      'https://www.youtube-nocookie.com/embed/abcdefghijk',
    );
    expect(toVideoEmbedUrl('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789?dnt=1');
    expect(toVideoEmbedUrl('https://evil.example/watch?v=abc')).toBeNull();
  });
});
