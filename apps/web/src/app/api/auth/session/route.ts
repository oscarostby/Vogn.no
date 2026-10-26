import { accountAuthRoute } from '@/server/account-auth-route';
import { getClerkUserId } from '@/server/auth';
import { route } from '@/server/http/route';
import { revokeAccountSession } from '@/server/account-sessions';
import { checkPrivateTestOrigin } from '@/server/private-test-auth';
import { testSessionCookieFromRequest, TEST_SESSION_COOKIE } from '@/server/test-session';
import { getEnv } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = accountAuthRoute(false);
export const GET = route({ auth: 'none' }, async ({ req }) => ({ signedIn: Boolean(await getClerkUserId(req)) }));
export const DELETE = route({ auth: 'none' }, async ({ req, ctx }) => {
  checkPrivateTestOrigin(req);
  await revokeAccountSession(ctx, testSessionCookieFromRequest(req));
  const secure = getEnv().NODE_ENV === 'production' || new URL(req.url).protocol === 'https:';
  return Response.json({ data: { signedIn: false } }, {
    headers: { 'Cache-Control': 'no-store', 'Set-Cookie': `${TEST_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}` },
  });
});
