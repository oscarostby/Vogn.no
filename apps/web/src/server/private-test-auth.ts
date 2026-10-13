import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Database } from './db';
import { getEnv, isConfigured, missingVars } from './env';
import { configMissing, forbidden } from './errors';
import { testSessionCookieFromRequest, verifyTestSession } from './test-session';

interface PrivateTestIdentity {
  /** Stable login name, independent of editable public profile username. */
  _id: string;
  identityId: string;
  createdAt: Date;
}

export function privateTestIdentities(database: Database) {
  return database.db.collection<PrivateTestIdentity>('privateTestIdentities');
}

export function privateTestAuthEnabled(): boolean {
  const env = getEnv();
  return env.TEST_AUTH_ENABLED && env.NEXT_PUBLIC_TEST_AUTH_ENABLED;
}

export function requirePrivateTestAuth(): void {
  if (!privateTestAuthEnabled() || !isConfigured('auth')) throw configMissing('Private testing authentication', missingVars('auth'));
}

/** Login and logout require a browser Origin matching this exact deployment. Bearer headers cannot bypass this. */
export function checkPrivateTestOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin || req.headers.get('sec-fetch-site') === 'cross-site') {
    throw forbidden('Cross-origin request blocked.');
  }
}

export async function getOrCreatePrivateTestIdentity(database: Database, loginName: string): Promise<string> {
  const identity = await privateTestIdentities(database).findOneAndUpdate(
    { _id: loginName.toLowerCase() },
    { $setOnInsert: { identityId: `test:${randomUUID()}`, createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  if (!identity) throw new Error('Unable to create testing identity');
  return identity.identityId;
}

export async function privateTestIdentityFromToken(token: string | null | undefined, database: Database): Promise<string | null> {
  if (!privateTestAuthEnabled()) return null;
  const env = getEnv();
  const identityId = verifyTestSession(token, env.APP_SIGNING_SECRET, env.TEST_AUTH_PASSWORD);
  if (!identityId) return null;
  const identity = await privateTestIdentities(database).findOne({ identityId }, { projection: { _id: 1 } });
  return identity ? identityId : null;
}

export async function privateTestIdentityFromRequest(req: Request, database: Database): Promise<string | null> {
  return privateTestIdentityFromToken(testSessionCookieFromRequest(req), database);
}
