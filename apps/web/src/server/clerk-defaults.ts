import 'server-only';
import { PUBLIC_DEFAULTS } from '../config/public-defaults';

/** Committed at the owner's explicit request. Environment values can replace these later. */
export const CLERK_DEFAULTS = {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: PUBLIC_DEFAULTS.clerkPublishableKey,
  CLERK_SECRET_KEY: 'sk_test_DZAFZT8U1YYMajluJE2Xs9rokK6MT81qVFWgq8Iqy5',
} as const;

/** Clerk reads process configuration during module initialization, before request handlers execute. */
export function applyClerkRuntimeDefaults(raw: Record<string, string | undefined> = process.env): void {
  if (raw.NODE_ENV === 'test' || raw.NEXT_PUBLIC_CLERK_ENABLED === 'false') return;
  for (const [name, value] of Object.entries(CLERK_DEFAULTS)) {
    if (!raw[name]) raw[name] = value;
  }
}

applyClerkRuntimeDefaults();
