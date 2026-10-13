import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getEnv, isConfigured } from './env';
import { getDatabase } from './db';
import { privateTestIdentityFromToken } from './private-test-auth';
import { TEST_SESSION_COOKIE } from './test-session';

/** Clerk user id for server components (null when signed out or auth is not configured). */
export async function currentClerkUserId(): Promise<string | null> {
  if (!isConfigured('auth')) return null;
  if (getEnv().TEST_AUTH_ENABLED) {
    const token = (await cookies()).get(TEST_SESSION_COOKIE)?.value;
    return privateTestIdentityFromToken(token, await getDatabase());
  }
  const { userId } = await auth();
  return userId ?? null;
}

/** Page-level guard (resource-based check in addition to the proxy redirect). */
export async function requireSignedIn(returnTo: string): Promise<string> {
  const userId = await currentClerkUserId();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  return userId;
}
