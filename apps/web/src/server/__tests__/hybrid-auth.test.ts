import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as registerRoute from '@/app/api/auth/register/route';
import * as sessionRoute from '@/app/api/auth/session/route';
import * as meRoute from '@/app/api/v1/me/route';
import { getClerkUserId, setTestAuthResolver } from '@/server/auth';
import { getEnv, overrideEnvForTests, type Env } from '@/server/env';
import { call, startHarness, type Harness } from '@/test/harness';

const clerk = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: clerk.auth, clerkClient: vi.fn() }));
let h: Harness;
let previous: Env;
beforeAll(async () => {
  previous = { ...getEnv() };
  h = await startHarness();
  setTestAuthResolver(null);
  overrideEnvForTests({ TEST_AUTH_ENABLED: true, NEXT_PUBLIC_TEST_AUTH_ENABLED: true, TEST_AUTH_PASSWORD: 'isolated-shared-password-12345', APP_SIGNING_SECRET: 'isolated-signing-secret-0123456789abcdef', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder', CLERK_SECRET_KEY: 'sk_test_placeholder' });
});
afterAll(async () => { overrideEnvForTests(previous); await h?.stop(); });

describe('Clerk social sessions alongside personal accounts', () => {
  it('accepts Clerk users while the built-in account backend is enabled', async () => {
    clerk.auth.mockResolvedValue({ userId: 'user_social_google' });
    expect(await getClerkUserId(new Request('http://localhost:3000/api/v1/me'))).toBe('user_social_google');
    const me = await call<{ needsOnboarding: boolean }>(meRoute.GET);
    expect(me.status).toBe(200);
    expect(me.data.needsOnboarding).toBe(true);
    const status = await call<{ signedIn: boolean }>(sessionRoute.GET);
    expect(status.data.signedIn).toBe(true);
  });

  it('keeps the explicit personal-account session authoritative and preserves existing identities', async () => {
    const result = await registerRoute.POST(new Request('http://localhost:3000/api/auth/register', {
      method: 'POST', headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginName: 'local_hybrid_user', password: 'personal-hybrid-password-12345' }),
    }), { params: Promise.resolve({}) });
    expect(result.status).toBe(201);
    clerk.auth.mockClear();
    const cookie = result.headers.get('set-cookie')!.split(';')[0]!;
    expect(await getClerkUserId(new Request('http://localhost:3000/api/v1/me', { headers: { cookie } }))).toMatch(/^test:/);
    expect(clerk.auth).not.toHaveBeenCalled();
  });

  it('rejects requests with neither a valid personal session nor a verified Clerk session', async () => {
    clerk.auth.mockResolvedValue({ userId: null });
    expect((await call(meRoute.GET, { headers: { cookie: `vogn_private_test_session=account.${'a'.repeat(43)}` } })).status).toBe(401);
    expect((await call<{ signedIn: boolean }>(sessionRoute.GET)).data.signedIn).toBe(false);
  });
});
