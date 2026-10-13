import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const TEST_SESSION_COOKIE = 'vogn_private_test_session';
export const TEST_SESSION_SECONDS = 24 * 60 * 60;
const IDENTITY = /^test:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isPrivateTestIdentity(identity: string): boolean {
  return IDENTITY.test(identity);
}

/** Compare fixed-size digests so password length and prefix never affect the comparison. */
export function matchesTestPassword(supplied: string, expected: string): boolean {
  return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest());
}

function passwordVersion(password: string): string {
  return createHash('sha256').update(`vogn-private-test-password:${password}`).digest('base64url');
}

function signature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(`vogn-private-test-session:${payload}`).digest();
}

export function signTestSession(identity: string, secret: string, password: string, now = Date.now()): string {
  if (!isPrivateTestIdentity(identity) || secret.length < 32 || password.length < 16) throw new Error('Invalid private testing session configuration');
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, sub: identity, iat, exp: iat + TEST_SESSION_SECONDS, key: passwordVersion(password) })).toString('base64url');
  return `${payload}.${signature(payload, secret).toString('base64url')}`;
}

export function verifyTestSession(token: string | null | undefined, secret: string | undefined, password: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 2048 || !secret || secret.length < 32 || !password || password.length < 16) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0] ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(parts[1] ?? '')) return null;
  const [payload, supplied] = parts as [string, string];
  const digest = Buffer.from(supplied, 'base64url');
  if (digest.length !== 32 || !timingSafeEqual(signature(payload, secret), digest)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const seconds = Math.floor(now / 1000);
    if (data.v !== 1 || typeof data.sub !== 'string' || !isPrivateTestIdentity(data.sub)) return null;
    if (typeof data.iat !== 'number' || typeof data.exp !== 'number' || !Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp)) return null;
    if (data.iat > seconds + 30 || data.exp <= seconds || data.exp - data.iat !== TEST_SESSION_SECONDS) return null;
    if (typeof data.key !== 'string' || !matchesTestPassword(data.key, passwordVersion(password))) return null;
    return data.sub;
  } catch {
    return null;
  }
}

export function testSessionCookieFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  for (const pair of cookie.split(';')) {
    const separator = pair.indexOf('=');
    if (pair.slice(0, separator).trim() === TEST_SESSION_COOKIE) return pair.slice(separator + 1).trim();
  }
  return null;
}
