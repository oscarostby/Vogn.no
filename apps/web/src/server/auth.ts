import 'server-only';
import { auth } from '@clerk/nextjs/server';
import type { Database } from './db';
import { getEnv, isConfigured, missingVars } from './env';
import { configMissing } from './errors';
import { type Actor, actorFromUser } from './context';
import { getDatabase } from './db';
import { privateTestIdentityFromRequest } from './private-test-auth';

export interface AuthState {
  clerkUserId: string | null;
  actor: Actor | null;
}

let testAuth: ((req: Request) => string | null) | null = null;

/**
 * Integration-test hook: resolves the Clerk user id from the request in tests only.
 * Guarded so it can never be enabled outside NODE_ENV=test.
 */
export function setTestAuthResolver(resolver: ((req: Request) => string | null) | null): void {
  if (getEnv().NODE_ENV !== 'test') throw new Error('Test auth resolver is only available in tests');
  testAuth = resolver;
}

/** Resolves the Clerk session (cookie for web, `Authorization: Bearer` for mobile). */
export async function getClerkUserId(req: Request): Promise<string | null> {
  if (testAuth && getEnv().NODE_ENV === 'test') return testAuth(req);
  if (!isConfigured('auth')) throw configMissing('Authentication', missingVars('auth'));
  if (getEnv().TEST_AUTH_ENABLED) return privateTestIdentityFromRequest(req, await getDatabase());
  const { userId } = await auth();
  return userId ?? null;
}

export async function resolveAuth(req: Request, database: Database): Promise<AuthState> {
  const clerkUserId = await getClerkUserId(req);
  if (!clerkUserId) return { clerkUserId: null, actor: null };
  const user = await database.cols.users.findOne({ clerkUserId, status: { $ne: 'deleted' } });
  if (!user) return { clerkUserId, actor: null };

  // Lazily record activity (at most every 5 minutes) without blocking the request.
  const now = Date.now();
  if (!user.lastActiveAt || now - user.lastActiveAt.getTime() > 5 * 60_000) {
    void database.cols.users.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date(now) } }).catch(() => undefined);
  }
  return { clerkUserId, actor: actorFromUser(user) };
}

/** Clerk user ids listed in PLATFORM_ADMIN_CLERK_IDS are promoted to platform admin on onboarding/sync. */
export function isBootstrapAdmin(clerkUserId: string): boolean {
  return getEnv().PLATFORM_ADMIN_CLERK_IDS.includes(clerkUserId);
}
