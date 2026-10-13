import { LOCALES } from '@vogn/types';
import { COUNTRY_CODES, isValidTimeZone, normalizeText } from '@vogn/utils';
import { z } from 'zod';

/**
 * Validation messages are i18n keys (namespace `validation.*`) so web and mobile can localise them.
 */
export const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'validation.id');
export const optionalObjectId = objectId.nullable().optional();

export const cursor = z.string().min(1).max(512);

export const limitParam = (max = 100, fallback = 30) =>
  z.coerce.number().int().min(1, 'validation.limit').max(max, 'validation.limit').default(fallback);

export const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'validation.color');

export const localeSchema = z.enum(LOCALES);
export const countryCode = z.enum(COUNTRY_CODES, 'validation.country');

export const timeZone = z.string().min(1).max(64).refine(isValidTimeZone, 'validation.timezone');

export const isoDateTime = z.iso.datetime({ offset: true, error: 'validation.datetime' });

/** Single-line user text: trimmed, control characters stripped, NFC normalised. */
export const singleLine = (min: number, max: number, key = 'validation.text') =>
  z
    .string()
    .transform((s) => normalizeText(s))
    .pipe(z.string().min(min, `${key}.min`).max(max, `${key}.max`));

/** Multi-line user text (bios, descriptions, messages). */
export const multiLine = (min: number, max: number, key = 'validation.text') =>
  z
    .string()
    .transform((s) => normalizeText(s, true))
    .pipe(z.string().min(min, `${key}.min`).max(max, `${key}.max`));

export const optionalSingleLine = (max: number, key?: string) =>
  z
    .union([singleLine(0, max, key), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v));

export const optionalMultiLine = (max: number, key?: string) =>
  z
    .union([multiLine(0, max, key), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v));

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const httpsUrl = z.string().trim().max(2048).refine(isHttpsUrl, 'validation.url');

export const idempotencyKey = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'validation.idempotencyKey');

export const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'validation.currency');

export const money = z.object({
  amount: z.number().min(0).max(100_000_000),
  currency: currencyCode,
});

export const paginationQuery = z.object({
  cursor: cursor.optional(),
  limit: limitParam(),
});

export const tagList = (maxItems: number, maxLength = 32) =>
  z
    .array(singleLine(1, maxLength))
    .max(maxItems, 'validation.tooMany')
    .transform((items) => [...new Set(items.map((t) => t.toLowerCase()))]);
