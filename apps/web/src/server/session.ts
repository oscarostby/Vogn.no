import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { isConfigured } from './env';

/** Clerk user id for server components (null when signed out or auth is not configured). */
export async function currentClerkUserId(): Promise<string | null> {
  if (!isConfigured('auth')) return null;
  const { userId } = await auth();
  return userId ?? null;
}

/** Page-level guard (resource-based check in addition to the proxy redirect). */
export async function requireSignedIn(returnTo: string): Promise<string> {
  const userId = await currentClerkUserId();
  if (!userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  return userId;
}
