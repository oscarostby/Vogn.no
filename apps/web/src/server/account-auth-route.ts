import 'server-only';
import { randomUUID } from 'node:crypto';
import { isDuplicateKeyError } from '@vogn/database';
import { usernameSchema } from '@vogn/validation';
import { z } from 'zod';
import { createAccountSession } from './account-sessions';
import { requestFingerprint } from './crypto';
import { getEnv } from './env';
import { AppError, conflict, unauthenticated } from './errors';
import { errorResponse, route } from './http/route';
import { hashPassword, verifyPassword } from './passwords';
import { checkPrivateTestOrigin, privateTestAuthEnabled, privateTestIdentities, requirePrivateTestAuth } from './private-test-auth';
import { enforceRateLimit } from './rate-limit';
import { matchesTestPassword, TEST_SESSION_COOKIE, TEST_SESSION_SECONDS } from './test-session';

type Segment = { params: Promise<Record<string, string | string[] | undefined>> };

export function accountAuthRoute(register: boolean) {
  const handler = route({
    auth: 'none', maxBodyBytes: 2048,
    body: z.object({
      loginName: register ? usernameSchema.transform((value) => value.toLowerCase()) : z.string().trim().min(3).max(24).transform((value) => value.toLowerCase()),
      password: z.string().min(register ? 12 : 1, 'Use at least 12 characters.').max(128),
    }),
    rateLimit: { name: register ? 'accounts.register' : 'accounts.login', limit: 10, windowSeconds: 900 },
  }, async ({ req, ctx, body }) => {
    const database = ctx;
    const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const name = register ? 'accounts.register' : 'accounts.login';
    await enforceRateLimit(database, { name: `${name}-ip`, limit: 10, windowSeconds: 900 }, requestFingerprint(ip, null) ?? 'unknown-ip');
    await enforceRateLimit(database, { name: `${name}-account`, limit: 10, windowSeconds: 900 }, body.loginName);
    const identities = privateTestIdentities(database);
    let identity = await identities.findOne({ _id: body.loginName });
    if (register) {
      if (identity) throw conflict('This login name is already in use. Sign in or choose another name.');
      identity = {
        _id: body.loginName, identityId: `test:${randomUUID()}`, createdAt: new Date(), passwordHash: await hashPassword(body.password),
      };
      try {
        await identities.insertOne(identity);
      } catch (error) {
        if (isDuplicateKeyError(error)) throw conflict('This login name is already in use. Sign in or choose another name.');
        throw error;
      }
    } else {
      const personalPassword = await verifyPassword(body.password, identity?.passwordHash);
      // Existing invited testers can still return to their account. Login never creates an account.
      const legacyPassword = getEnv().LEGACY_TEST_AUTH_ENABLED && identity && !identity.passwordHash && matchesTestPassword(body.password, getEnv().TEST_AUTH_PASSWORD!);
      if (!identity || (!personalPassword && !legacyPassword)) throw unauthenticated('Incorrect username or password.');
    }
    const user = await database.cols.users.findOne({ clerkUserId: identity.identityId, status: { $ne: 'deleted' } }, { projection: { _id: 1 } });
    const token = await createAccountSession(database, identity.identityId);
    const secure = getEnv().NODE_ENV === 'production' || new URL(req.url).protocol === 'https:';
    return Response.json({ data: { signedIn: true, next: user ? '/home' : '/onboarding' } }, {
      status: register ? 201 : 200,
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': `${TEST_SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${TEST_SESSION_SECONDS}${secure ? '; Secure' : ''}`,
      },
    });
  });

  return async (req: Request, segment: Segment): Promise<Response> => {
    try {
      if (!privateTestAuthEnabled()) throw new AppError('NOT_FOUND', 'Not found.');
      requirePrivateTestAuth();
      checkPrivateTestOrigin(req);
      return await handler(req, segment);
    } catch (error) {
      return errorResponse(error, randomUUID());
    }
  };
}
