import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { getEnv } from '../env';

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
  if (override) return;
  const client = await clerkClient();
  await client.users.deleteUser(clerkUserId);
}
