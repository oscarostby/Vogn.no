/** Locale + time-zone aware formatting built on Intl (works on web, Node and Hermes). */

export function formatDateTime(
  value: Date | string | number,
  locale = 'en',
  timeZone?: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en', options).format(date);
  }
}

export function formatDate(value: Date | string | number, locale = 'en', timeZone?: string): string {
  return formatDateTime(value, locale, timeZone, { dateStyle: 'medium' });
}

export function formatTime(value: Date | string | number, locale = 'en', timeZone?: string): string {
  return formatDateTime(value, locale, timeZone, { timeStyle: 'short' });
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

export function formatRelative(value: Date | string | number, locale = 'en', now: Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 45) return rtf.format(0, 'second');
  for (const [unit, seconds] of UNITS) {
    if (abs >= seconds) return rtf.format(Math.round(diffSeconds / seconds), unit);
  }
  return rtf.format(diffSeconds, 'second');
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Minutes since midnight of `date` in `timeZone` (falls back to UTC for unknown zones). */
export function minutesInTimeZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
    const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hh * 60 + mm;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

/** True when `date` falls inside a quiet-hours window "HH:MM"–"HH:MM" in the given time zone. */
export function isWithinQuietHours(date: Date, start: string, end: string, timeZone: string): boolean {
  const toMinutes = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const now = minutesInTimeZone(date, timeZone);
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  return s < e ? now >= s && now < e : now >= s || now < e;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}
