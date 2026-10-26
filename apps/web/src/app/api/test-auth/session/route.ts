import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getEnv } from '@/server/env';
import { AppError, unauthenticated } from '@/server/errors';
import { errorResponse, route } from '@/server/http/route';
import { getDatabase } from '@/server/db';
import { requestFingerprint } from '@/server/crypto';
import { enforceRateLimit } from '@/server/rate-limit';
import { checkPrivateTestOrigin, getOrCreatePrivateTestIdentity, privateTestAuthEnabled, privateTestIdentityFromRequest, requirePrivateTestAuth } from '@/server/private-test-auth';
import { matchesTestPassword, signTestSession, testSessionCookieFromRequest, TEST_SESSION_COOKIE, TEST_SESSION_SECONDS } from '@/server/test-session';
import { revokeAccountSession } from '@/server/account-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  loginName: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_]+$/).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
});

function response(data: unknown, cookie?: string): Response {
  return Response.json({ data }, {
    headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) },
  });
}

function cookie(token: string, maxAge: number, req: Request): string {
  const secure = getEnv().NODE_ENV === 'production' || new URL(req.url).protocol === 'https:';
  return `${TEST_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

type RouteHandler = (req: Request, segment: { params: Promise<Record<string, string | string[] | undefined>> }) => Promise<Response>;

/** Disabled endpoints stay closed even when no database is configured. */
function testingOnly(handler: RouteHandler, mutation = false) {
  return async (req: Request, segment: { params: Promise<Record<string, string | string[] | undefined>> }): Promise<Response> => {
    try {
      if (!privateTestAuthEnabled() || !getEnv().LEGACY_TEST_AUTH_ENABLED) throw new AppError('NOT_FOUND', 'Not found.');
      requirePrivateTestAuth();
      if (mutation) checkPrivateTestOrigin(req);
      return await handler(req, segment);
    } catch (error) {
      return errorResponse(error, randomUUID());
    }
  };
}

export const POST = testingOnly(route(
  { auth: 'none', body: loginSchema, maxBodyBytes: 2048, rateLimit: { name: 'private-test.login', limit: 10, windowSeconds: 900 } },
  async ({ req, body }) => {
    const env = getEnv();
    const database = await getDatabase();
    const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    await enforceRateLimit(database, { name: 'private-test.login-ip', limit: 10, windowSeconds: 900 }, requestFingerprint(ip, null) ?? 'unknown-ip');
    if (!matchesTestPassword(body.password, env.TEST_AUTH_PASSWORD!)) throw unauthenticated('Incorrect test password.');
    const identityId = await getOrCreatePrivateTestIdentity(database, body.loginName);
    const user = await database.cols.users.findOne({ clerkUserId: identityId, status: { $ne: 'deleted' } }, { projection: { _id: 1 } });
    const token = signTestSession(identityId, env.APP_SIGNING_SECRET!, env.TEST_AUTH_PASSWORD!);
    return response({ signedIn: true, next: user ? '/home' : '/onboarding' }, cookie(token, TEST_SESSION_SECONDS, req));
  },
), true);

export const GET = testingOnly(route({ auth: 'none' }, async ({ req }) => {
  const identity = await privateTestIdentityFromRequest(req, await getDatabase());
  return response({ signedIn: Boolean(identity) });
}));

export const DELETE = testingOnly(route({ auth: 'none' }, async ({ req }) => {
  await revokeAccountSession(await getDatabase(), testSessionCookieFromRequest(req));
  return response({ signedIn: false }, cookie('', 0, req));
}), true);
