import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  ensureContrast,
  extractMentions,
  isValidReaction,
  isWithinQuietHours,
  normalizeText,
  parseInline,
  parseMarkdown,
  safeHref,
  slugify,
  toPlainText,
} from './index';

describe('slugify', () => {
  it('transliterates nordic characters and collapses separators', () => {
    expect(slugify('Øst-Lands  Ærlige Ålesund!!')).toBe('ost-lands-aerlige-alesund');
    expect(slugify('Tokyo ドリフト Crew')).toBe('tokyo-crew');
    expect(slugify('---')).toBe('');
  });
});

describe('color contrast', () => {
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#101114', '#101114')).toBeCloseTo(1, 5);
  });
  it('repairs unreadable foregrounds', () => {
    const fixed = ensureContrast('#202020', '#101114', 4.5);
    expect(contrastRatio(fixed, '#101114')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#F5F5F6', '#101114')).toBe('#F5F5F6');
  });
});

describe('markdown', () => {
  it('parses inline formatting without producing HTML', () => {
    const nodes = parseInline('**bold** and *it* `code` ||secret||');
    expect(nodes.map((n) => n.type)).toEqual(['bold', 'text', 'italic', 'text', 'code', 'text', 'spoiler']);
  });

  it('only allows safe link protocols', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('https://vogn.no/c/test')).toBe('https://vogn.no/c/test');
    const nodes = parseInline('[x](javascript:alert(1))');
    expect(nodes.every((n) => n.type === 'text')).toBe(true);
  });

  it('treats raw html as text', () => {
    const blocks = parseMarkdown('<img src=x onerror=alert(1)>');
    expect(toPlainText(blocks)).toBe('<img src=x onerror=alert(1)>');
  });

  it('parses code fences and quotes', () => {
    const blocks = parseMarkdown('> quoted\n```ts\nconst a = 1;\n```\nafter');
    expect(blocks.map((b) => b.type)).toEqual(['quote', 'codeBlock', 'paragraph']);
  });

  it('extracts mentions', () => {
    const id = 'a'.repeat(24);
    const m = extractMentions(`hi <@${id}> and <@&${'b'.repeat(24)}> @everyone`);
    expect(m.userIds).toEqual([id]);
    expect(m.roleIds).toHaveLength(1);
    expect(m.everyone).toBe(true);
  });
});

describe('text helpers', () => {
  it('normalizes control characters', () => {
    expect(normalizeText('a\u0000b   c')).toBe('ab c');
    expect(normalizeText('line1\n\n\n\n\nline2', true)).toBe('line1\n\n\nline2');
  });
  it('validates reactions', () => {
    expect(isValidReaction('🔥')).toBe(true);
    expect(isValidReaction('👍🏽')).toBe(true);
    expect(isValidReaction(':turbo:')).toBe(true);
    expect(isValidReaction('<script>')).toBe(false);
    expect(isValidReaction('abc')).toBe(false);
  });
});

describe('quiet hours', () => {
  it('handles windows crossing midnight', () => {
    const at = (iso: string) => new Date(iso);
    expect(isWithinQuietHours(at('2026-01-01T23:30:00Z'), '22:00', '07:00', 'UTC')).toBe(true);
    expect(isWithinQuietHours(at('2026-01-01T06:59:00Z'), '22:00', '07:00', 'UTC')).toBe(true);
    expect(isWithinQuietHours(at('2026-01-01T12:00:00Z'), '22:00', '07:00', 'UTC')).toBe(false);
    // Oslo is UTC+1 in January
    expect(isWithinQuietHours(at('2026-01-01T21:30:00Z'), '22:00', '07:00', 'Europe/Oslo')).toBe(true);
  });
});
