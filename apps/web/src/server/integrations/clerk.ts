import 'server-only';
import '../clerk-defaults';
import { clerkClient } from '@clerk/nextjs/server';
import { getEnv } from '../env';
import { getDatabase } from '../db';
import { privateTestIdentities, privateTestAuthEnabled } from '../private-test-auth';
import { isPrivateTestIdentity } from '../test-session';
import { accountSessions } from '../account-sessions';

export interface ClerkUserInfo {
  emailVerified: boolean;
  phoneVerified: boolean;
  username: string | null;
}

let override: ((clerkUserId: string) => Promise<ClerkUserInfo>) | null = null;
export function setClerkInfoForTests(fn: typeof override): void {
  if (getEnv().NODE_ENV !== 'test') throw new Error('test only');
  override = fn;
}

/**
 * Reads verification state from Clerk. We deliberately do not copy the email address, phone number or
 * real name into VOGN's database: Clerk remains the only store of those identifiers.
 */
export async function getClerkUserInfo(clerkUserId: string): Promise<ClerkUserInfo> {
  if (isPrivateTestIdentity(clerkUserId)) {
    if (!privateTestAuthEnabled()) throw new Error('Private testing authentication is disabled');
    const identity = await privateTestIdentities(await getDatabase()).findOne({ identityId: clerkUserId });
    if (!identity) throw new Error('Private testing identity no longer exists');
    return { emailVerified: false, phoneVerified: false, username: identity._id };
  }
  if (override) return override(clerkUserId);
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  const phone = user.phoneNumbers.find((p) => p.id === user.primaryPhoneNumberId) ?? user.phoneNumbers[0];
  return {
    emailVerified: email?.verification?.status === 'verified',
    phoneVerified: phone?.verification?.status === 'verified',
    username: user.username ?? null,
  };
}

export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  if (isPrivateTestIdentity(clerkUserId)) {
    const database = await getDatabase();
    await privateTestIdentities(database).deleteOne({ identityId: clerkUserId });
    await accountSessions(database).deleteMany({ identityId: clerkUserId });
    return;
  }
  if (override) return;
  const client = await clerkClient();
  await client.users.deleteUser(clerkUserId);
}
