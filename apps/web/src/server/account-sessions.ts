import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { Database } from './db';
import { TEST_SESSION_SECONDS } from './test-session';

interface AccountSession {
  _id: string;
  identityId: string;
  expiresAt: Date;
}

export function isAccountSessionToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && /^account\.[A-Za-z0-9_-]{43}$/.test(token);
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function accountSessions(database: Database) {
  return database.db.collection<AccountSession>('accountSessions');
}

/** Only a hash is stored. These sessions do not depend on the committed test signing key. */
export async function createAccountSession(database: Database, identityId: string): Promise<string> {
  const token = `account.${randomBytes(32).toString('base64url')}`;
  await accountSessions(database).insertOne({
    _id: tokenHash(token), identityId, expiresAt: new Date(Date.now() + TEST_SESSION_SECONDS * 1000),
  });
  return token;
}

export async function accountSessionIdentity(database: Database, token: string): Promise<string | null> {
  if (!isAccountSessionToken(token)) return null;
  const session = await accountSessions(database).findOne({ _id: tokenHash(token), expiresAt: { $gt: new Date() } });
  return session?.identityId ?? null;
}

export async function revokeAccountSession(database: Database, token: string | null): Promise<void> {
  if (isAccountSessionToken(token)) await accountSessions(database).deleteOne({ _id: tokenHash(token) });
}
