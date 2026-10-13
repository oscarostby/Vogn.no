import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getEnv, missingVars } from './env';
import { configMissing } from './errors';

function encryptionKey(): Buffer {
  const env = getEnv();
  if (!env.DATA_ENCRYPTION_KEY) throw configMissing('Field encryption', missingVars('encryption', env));
  const key = Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) throw configMissing('Field encryption (DATA_ENCRYPTION_KEY must be 32 bytes, base64)', ['DATA_ENCRYPTION_KEY']);
  return key;
}

function signingKey(): Buffer {
  const env = getEnv();
  if (!env.APP_SIGNING_SECRET || env.APP_SIGNING_SECRET.length < 32) {
    throw configMissing('Token signing (APP_SIGNING_SECRET ≥ 32 chars)', ['APP_SIGNING_SECRET']);
  }
  return Buffer.from(env.APP_SIGNING_SECRET, 'utf8');
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
}

export function decryptField(payload: string): string {
  const [version, iv, tag, data] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Keyed hash for equality lookups on encrypted values (e.g. duplicate registration numbers). */
export function lookupHash(value: string, purpose: string): string {
  return createHmac('sha256', encryptionKey()).update(`${purpose}:${value}`).digest('base64url');
}

/** Hash of request metadata for audit logs. Uses the signing key when available, otherwise a plain digest prefix. */
export function requestFingerprint(ip: string | null, userAgent: string | null): string | null {
  if (!ip && !userAgent) return null;
  try {
    return createHmac('sha256', signingKey()).update(`${ip ?? ''}|${userAgent ?? ''}`).digest('base64url').slice(0, 22);
  } catch {
    return null;
  }
}

/* ----------------------------- signed tokens ------------------------------ */

export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }), 'utf8').toString(
    'base64url',
  );
  const sig = createHmac('sha256', signingKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', signingKey()).update(body).digest();
  const actual = Buffer.from(sig, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp?: number };
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomCode(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}
