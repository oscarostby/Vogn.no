export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (first + second).toUpperCase();
}

export function compactNumber(n: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export const OBJECT_ID_RE = /^[a-f0-9]{24}$/;

export function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && OBJECT_ID_RE.test(value);
}

// Control characters except tab/newline handling below.
// eslint-disable-next-line no-control-regex
const CONTROL_SINGLE = /[\u0000-\u001F\u007F]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_MULTI = /[\u0000-\u0009\u000B-\u001F\u007F]/g;

/** Strip control characters and normalise whitespace (keeps newlines when `multiline`). */
export function normalizeText(input: string, multiline = false): string {
  const stripped = input.replace(multiline ? CONTROL_MULTI : CONTROL_SINGLE, '').normalize('NFC');
  return multiline ? stripped.replace(/\n{4,}/g, '\n\n\n').trim() : stripped.replace(/\s+/g, ' ').trim();
}

/** Allowed reactions: a single emoji grapheme (incl. ZWJ sequences / modifiers) or a :custom_name: token. */
export function isValidReaction(value: string): boolean {
  if (/^:[a-z0-9_]{2,32}:$/.test(value)) return true;
  if (value.length > 16) return false;
  return /^(\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(\p{Emoji_Modifier}|️|‍\p{Extended_Pictographic})*$/u.test(
    value,
  );
}

/** Random, human-friendly code without ambiguous characters (0/O, 1/I/L). Uses the provided RNG bytes. */
export function codeFromBytes(bytes: Uint8Array, length: number): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  return out;
}
