import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as registerRoute from '@/app/api/auth/register/route';
import * as sessionRoute from '@/app/api/auth/session/route';
import * as legacyRoute from '@/app/api/test-auth/session/route';
import * as meRoute from '@/app/api/v1/me/route';
import * as onboardingRoute from '@/app/api/v1/me/onboarding/route';
import * as deletionRoute from '@/app/api/v1/me/delete/route';
import { setTestAuthResolver } from '@/server/auth';
import { accountSessions } from '@/server/account-sessions';
import { getEnv, overrideEnvForTests, type Env } from '@/server/env';
import { privateTestIdentities } from '@/server/private-test-auth';
import { getDatabase } from '@/server/db';
import { signTestSession, TEST_SESSION_COOKIE } from '@/server/test-session';
import { call, startHarness, type Harness } from '@/test/harness';

const sharedPassword = 'old-shared-test-password-123456';
const secret = 'test-only-signing-key-0123456789abcdef';
const passwordA = 'My personal password A!';
const passwordB = 'Another personal password B!';
let h: Harness;
let previous: Env;

beforeAll(async () => {
  previous = { ...getEnv() };
  h = await startHarness();
  setTestAuthResolver(null);
  overrideEnvForTests({ TEST_AUTH_ENABLED: true, NEXT_PUBLIC_TEST_AUTH_ENABLED: true, LEGACY_TEST_AUTH_ENABLED: true, TEST_AUTH_PASSWORD: sharedPassword, APP_SIGNING_SECRET: secret });
});

afterAll(async () => {
  overrideEnvForTests(previous);
  await h?.stop();
});

const segment = { params: Promise.resolve({}) };
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/auth/session', {
    method: 'POST', headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}
function cookie(response: Response) {
  return response.headers.get('set-cookie')!.split(';')[0]!;
}
async function register(loginName: string, password = passwordA) {
  return registerRoute.POST(request({ loginName, password }), segment);
}
async function login(loginName: string, password = passwordA) {
  return sessionRoute.POST(request({ loginName, password }), segment);
}

describe('personal account registration and login', () => {
  it('registers independent accounts with salted hashes and completes onboarding', async () => {
    const a = await register('Rider_A');
    const b = await register('rider_b', passwordB);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.headers.get('set-cookie')).toContain('HttpOnly; Path=/; SameSite=Lax');
    expect(cookie(a)).toMatch(/=account\./);
    const database = await getDatabase();
    const stored = await privateTestIdentities(database).findOne({ _id: 'rider_a' });
    expect(stored?.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(stored)).not.toContain(passwordA);
    const state = await call<{ suggestedUsername: string }>(meRoute.GET, { headers: { cookie: cookie(a) } });
    expect(state.data.suggestedUsername).toBe('rider_a');
    const profile = await call<{ id: string; platformRole: string }>(onboardingRoute.POST, {
      headers: { cookie: cookie(a) }, body: { username: 'rider_a', displayName: 'Rider A', acceptTerms: true },
    });
    expect(profile.status).toBe(201);
    expect(profile.data.platformRole).toBe('user');
    const returning = await login('RIDER_A');
    expect(returning.status).toBe(200);
    expect((await returning.json()).data.next).toBe('/home');
    const me = await call<{ id: string }>(meRoute.GET, { headers: { cookie: cookie(returning) } });
    expect(me.data.id).toBe(profile.data.id);
    expect((await call<{ needsOnboarding: boolean }>(meRoute.GET, { headers: { cookie: cookie(b) } })).data.needsOnboarding).toBe(true);
    const storedSession = await accountSessions(database).findOne({ identityId: stored!.identityId });
    expect(storedSession?._id).not.toBe(cookie(a).split('=')[1]);
  });

  it('rejects wrong passwords, another account password and all legacy shortcuts', async () => {
    for (const password of ['wrong', passwordB, sharedPassword]) {
      const result = await login('rider_a', password);
      expect(result.status).toBe(401);
      expect(result.headers.get('set-cookie')).toBeNull();
    }
    const bypass = await legacyRoute.POST(request({ loginName: 'rider_a', password: sharedPassword }), segment);
    expect(bypass.status).toBe(401);
    const identity = await privateTestIdentities(await getDatabase()).findOne({ _id: 'rider_a' });
    const forged = signTestSession(identity!.identityId, secret, sharedPassword);
    expect((await call(meRoute.GET, { headers: { cookie: `${TEST_SESSION_COOKIE}=${forged}` } })).status).toBe(401);
    expect((await login('missing_user')).status).toBe(401);
    expect(await privateTestIdentities(await getDatabase()).findOne({ _id: 'missing_user' })).toBeNull();
  });

  it('rejects duplicate registrations including races and weak or reserved names', async () => {
    expect((await register('RIDER_A', passwordB)).status).toBe(409);
    const racing = await Promise.all([register('race_user'), register('RACE_USER', passwordB)]);
    expect(racing.map((result) => result.status).sort()).toEqual([201, 409]);
    expect((await register('weak_password', 'short')).status).toBe(422);
    expect((await register('admin')).status).toBe(422);
    expect((await login('rider_a')).status).toBe(200);
  });

  it('blocks cross-origin registration and login, even with bearer headers', async () => {
    for (const handler of [registerRoute.POST, sessionRoute.POST]) {
      for (const origin of ['', 'https://evil.example']) {
        expect((await handler(request({ loginName: 'csrf_user', password: passwordA }, { origin, authorization: 'Bearer ignored' }), segment)).status).toBe(403);
      }
    }
  });

  it('revokes sessions on logout and rejects expired or fabricated opaque sessions', async () => {
    const a = await register('logout_user');
    const authenticated = cookie(a);
    const logout = await sessionRoute.DELETE(new Request('http://localhost:3000/api/auth/session', {
      method: 'DELETE', headers: { origin: 'http://localhost:3000', cookie: authenticated },
    }), segment);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await call(meRoute.GET, { headers: { cookie: authenticated } })).status).toBe(401);
    const relogin = await login('logout_user');
    const identity = await privateTestIdentities(await getDatabase()).findOne({ _id: 'logout_user' });
    await accountSessions(await getDatabase()).updateMany({ identityId: identity!.identityId }, { $set: { expiresAt: new Date(0) } });
    expect((await call(meRoute.GET, { headers: { cookie: cookie(relogin) } })).status).toBe(401);
    expect((await call(meRoute.GET, { headers: { cookie: `${TEST_SESSION_COOKIE}=account.${'a'.repeat(43)}` } })).status).toBe(401);
  });

  it('keeps existing invited accounts accessible without creating new shared-password identities', async () => {
    const identityId = `test:${randomUUID()}`;
    await privateTestIdentities(await getDatabase()).insertOne({ _id: 'legacy_user', identityId, createdAt: new Date() });
    expect((await login('legacy_user', sharedPassword)).status).toBe(200);
    expect((await register('legacy_user')).status).toBe(409);
  });

  it('disables shared-password login and legacy signed cookies for normal deployments', async () => {
    overrideEnvForTests({ LEGACY_TEST_AUTH_ENABLED: false });
    try {
      expect((await login('legacy_user', sharedPassword)).status).toBe(401);
      expect((await legacyRoute.POST(request({ loginName: 'new_legacy_user', password: sharedPassword }), segment)).status).toBe(404);
      const identity = await privateTestIdentities(await getDatabase()).findOne({ _id: 'legacy_user' });
      const signed = signTestSession(identity!.identityId, secret, sharedPassword);
      expect((await call(meRoute.GET, { headers: { cookie: `${TEST_SESSION_COOKIE}=${signed}` } })).status).toBe(401);
      expect((await login('rider_a')).status).toBe(200);
    } finally {
      overrideEnvForTests({ LEGACY_TEST_AUTH_ENABLED: true });
    }
  });

  it('revokes every session after account deletion', async () => {
    const a = await register('delete_account');
    const b = await login('delete_account');
    expect((await call(onboardingRoute.POST, { headers: { cookie: cookie(a) }, body: { username: 'delete_account', displayName: 'Delete', acceptTerms: true } })).status).toBe(201);
    expect((await call(deletionRoute.POST, { headers: { cookie: cookie(a) }, body: { confirmUsername: 'delete_account' } })).status).toBe(200);
    expect((await call(meRoute.GET, { headers: { cookie: cookie(b) } })).status).toBe(401);
    expect((await login('delete_account')).status).toBe(401);
  });

  it('rate limits attempts per IP even when browser identifiers change', async () => {
    const prior = process.env.ENFORCE_RATE_LIMITS;
    process.env.ENFORCE_RATE_LIMITS = '1';
    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect((await sessionRoute.POST(request({ loginName: `unknown_${attempt}`, password: passwordA }, {
          'x-forwarded-for': '192.0.2.44', 'user-agent': `browser-${attempt}`,
        }), segment)).status).toBe(401);
      }
      const limited = await sessionRoute.POST(request({ loginName: 'rider_a', password: passwordA }, { 'x-forwarded-for': '192.0.2.44' }), segment);
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBeTruthy();
    } finally {
      if (prior === undefined) delete process.env.ENFORCE_RATE_LIMITS;
      else process.env.ENFORCE_RATE_LIMITS = prior;
    }
  });
});
