import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as sessionRoute from '@/app/api/test-auth/session/route';
import * as meRoute from '@/app/api/v1/me/route';
import * as onboardingRoute from '@/app/api/v1/me/onboarding/route';
import * as deletionRoute from '@/app/api/v1/me/delete/route';
import * as discoveryRoute from '@/app/api/v1/discover/crews/route';
import * as publicProfileRoute from '@/app/api/v1/users/[username]/route';
import { setTestAuthResolver } from '@/server/auth';
import { getEnv, isConfigured, overrideEnvForTests, type Env } from '@/server/env';
import { matchesTestPassword, signTestSession, TEST_SESSION_SECONDS, verifyTestSession } from '@/server/test-session';
import { call, startHarness, type Harness } from '@/test/harness';

const secret = 'private-test-signing-secret-0123456789abcdef';
const password = 'private-test-invite-password-123456';
let h: Harness;
let previous: Env;

beforeAll(async () => {
  previous = { ...getEnv() };
  h = await startHarness();
  setTestAuthResolver(null);
  overrideEnvForTests({ TEST_AUTH_ENABLED: true, NEXT_PUBLIC_TEST_AUTH_ENABLED: true, LEGACY_TEST_AUTH_ENABLED: true, TEST_AUTH_PASSWORD: password, APP_SIGNING_SECRET: secret });
});

afterAll(async () => {
  overrideEnvForTests(previous);
  await h?.stop();
});

const segment = { params: Promise.resolve({}) };

function request(method: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/test-auth/session', {
    method,
    headers: { origin: 'http://localhost:3000', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function login(loginName: string) {
  const result = await sessionRoute.POST(request('POST', { loginName, password }), segment);
  const setCookie = result.headers.get('set-cookie')!;
  return { result, setCookie, cookie: setCookie.split(';')[0]! };
}

describe('signed private testing sessions', () => {
  it('rejects tampering, expired tokens, future tokens and rotated credentials', () => {
    const identity = `test:${randomUUID()}`;
    const now = Date.now();
    const token = signTestSession(identity, secret, password, now);
    expect(verifyTestSession(token, secret, password, now)).toBe(identity);
    const [payload, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')), sub: `test:${randomUUID()}` })).toString('base64url');
    expect(verifyTestSession(`${forged}.${signature}`, secret, password, now)).toBeNull();
    expect(verifyTestSession(`${token}.extra`, secret, password, now)).toBeNull();
    expect(verifyTestSession(token, secret, password, now + TEST_SESSION_SECONDS * 1000)).toBeNull();
    expect(verifyTestSession(signTestSession(identity, secret, password, now + 60_000), secret, password, now)).toBeNull();
    expect(verifyTestSession(token, `${secret}-rotated`, password, now)).toBeNull();
    expect(verifyTestSession(token, secret, `${password}-rotated`, now)).toBeNull();
    expect(verifyTestSession('malformed', secret, password, now)).toBeNull();
  });

  it('compares complete passwords including different lengths', () => {
    expect(matchesTestPassword(password, password)).toBe(true);
    expect(matchesTestPassword(`${password}x`, password)).toBe(false);
    expect(matchesTestPassword(password.slice(0, -1), password)).toBe(false);
    expect(() => signTestSession('user_real_clerk', secret, password)).toThrow();
  });

  it('is disabled by default and refuses incomplete explicit configuration', async () => {
    overrideEnvForTests({ TEST_AUTH_ENABLED: false, NEXT_PUBLIC_TEST_AUTH_ENABLED: false });
    expect((await sessionRoute.POST(request('POST', { loginName: 'closed', password }), segment)).status).toBe(404);
    overrideEnvForTests({ TEST_AUTH_ENABLED: true, NEXT_PUBLIC_TEST_AUTH_ENABLED: true, TEST_AUTH_PASSWORD: 'short' });
    expect(isConfigured('auth')).toBe(false);
    expect((await sessionRoute.POST(request('POST', { loginName: 'closed', password }), segment)).status).toBe(503);
    overrideEnvForTests({ TEST_AUTH_PASSWORD: password });
  });

  it('blocks cross-origin and missing-Origin login/logout even with bearer headers', async () => {
    for (const origin of ['https://evil.example', '']) {
      const headers = { origin, authorization: 'Bearer ignored' };
      expect((await sessionRoute.POST(request('POST', { loginName: 'csrf', password }, headers), segment)).status).toBe(403);
      expect((await sessionRoute.DELETE(request('DELETE', undefined, headers), segment)).status).toBe(403);
    }
    expect((await sessionRoute.POST(request('POST', { loginName: 'csrf', password }, { 'sec-fetch-site': 'cross-site' }), segment)).status).toBe(403);
  });

  it('requires the shared password before creating an identity', async () => {
    const result = await sessionRoute.POST(request('POST', { loginName: 'rejected', password: 'incorrect' }), segment);
    expect(result.status).toBe(401);
    expect(await h.db.db.collection<{ _id: string }>('privateTestIdentities').countDocuments({ _id: 'rejected' })).toBe(0);
    expect(result.headers.get('set-cookie')).toBeNull();
  });

  it('rate-limits failed logins using MongoDB even without Redis', async () => {
    const prior = process.env.ENFORCE_RATE_LIMITS;
    process.env.ENFORCE_RATE_LIMITS = '1';
    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect((await sessionRoute.POST(request('POST', { loginName: 'limited', password: 'incorrect' }, { 'x-forwarded-for': '192.0.2.55', 'user-agent': `varying-browser-${attempt}` }), segment)).status).toBe(401);
      }
      const limited = await sessionRoute.POST(request('POST', { loginName: 'limited', password }, { 'x-forwarded-for': '192.0.2.55' }), segment);
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBeTruthy();
    } finally {
      if (prior === undefined) delete process.env.ENFORCE_RATE_LIMITS;
      else process.env.ENFORCE_RATE_LIMITS = prior;
    }
  });

  it('persists separate test identities, completes real onboarding and returns to the same profile', async () => {
    const a = await login('Oscar_Test');
    const b = await login('Second_Test');
    expect(a.result.status).toBe(200);
    expect(a.setCookie).toContain('HttpOnly');
    expect(a.setCookie).toContain('SameSite=Lax');
    expect(a.setCookie).toContain('Max-Age=86400');
    const state = await call<{ needsOnboarding: boolean; suggestedUsername: string; emailVerified: boolean }>(meRoute.GET, { headers: { cookie: a.cookie } });
    expect(state.data.needsOnboarding).toBe(true);
    expect(state.data.suggestedUsername).toBe('oscar_test');
    expect(state.data.emailVerified).toBe(false);
    const profile = await call<{ id: string; clerkUserId: string; verificationLevels: string[] }>(onboardingRoute.POST, {
      headers: { cookie: a.cookie }, body: { username: 'oscar_test', displayName: 'Oscar', acceptTerms: true },
    });
    expect(profile.status).toBe(201);
    expect(profile.data.clerkUserId).toMatch(/^test:/);
    expect(profile.data.verificationLevels).toEqual([]);
    const csrf = await call(meRoute.PATCH, {
      method: 'PATCH', body: { bio: 'cross-site mutation' },
      headers: { cookie: a.cookie, origin: 'https://evil.example', authorization: 'Bearer ignored' },
    });
    expect(csrf.status).toBe(403);
    const returning = await login('OSCAR_TEST');
    expect((await returning.result.json()).data.next).toBe('/home');
    const me = await call<{ id: string }>(meRoute.GET, { headers: { cookie: returning.cookie } });
    expect(me.data.id).toBe(profile.data.id);
    const other = await call<{ needsOnboarding: boolean }>(meRoute.GET, { headers: { cookie: b.cookie } });
    expect(other.data.needsOnboarding).toBe(true);
    expect((await call(meRoute.PATCH, { method: 'PATCH', body: { bio: 'unsigned' } })).status).toBe(401);
    expect((await call(discoveryRoute.GET)).status).toBe(401);
    expect((await call(publicProfileRoute.GET, { params: { username: 'oscar_test' } })).status).toBe(401);
    expect((await call(discoveryRoute.GET, { headers: { cookie: a.cookie } })).status).toBe(200);
    expect((await call(publicProfileRoute.GET, { params: { username: 'oscar_test' }, headers: { cookie: b.cookie } })).status).toBe(403);
  });

  it('clears the cookie on logout and uses Secure cookies on HTTPS deployments', async () => {
    const result = await sessionRoute.DELETE(request('DELETE'), segment);
    expect(result.status).toBe(200);
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
    const secure = await sessionRoute.POST(new Request('https://private.example/api/test-auth/session', {
      method: 'POST', headers: { origin: 'https://private.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ loginName: 'secure', password }),
    }), segment);
    expect(secure.headers.get('set-cookie')).toContain('; Secure');
  });

  it('revokes the stored testing identity after account deletion', async () => {
    const a = await login('Delete_Test');
    expect((await call(onboardingRoute.POST, { headers: { cookie: a.cookie }, body: { username: 'delete_test', displayName: 'Delete', acceptTerms: true } })).status).toBe(201);
    expect((await call(deletionRoute.POST, { headers: { cookie: a.cookie }, body: { confirmUsername: 'delete_test' } })).status).toBe(200);
    expect(await h.db.db.collection<{ _id: string }>('privateTestIdentities').countDocuments({ _id: 'delete_test' })).toBe(0);
    expect((await call(meRoute.GET, { headers: { cookie: a.cookie } })).status).toBe(401);
  });
});
