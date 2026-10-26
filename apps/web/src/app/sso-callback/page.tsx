import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { SocialCallback } from '@/components/auth/social-callback';
import { clerkAuthConfigured } from '@/server/env';

export default function SsoCallbackPage() {
  return <AuthShell title="Signing you in" subtitle="Finishing your sign-in with Apple or Google.">
    {clerkAuthConfigured() ? <SocialCallback /> : <Link href="/sign-in" className="text-accent-text">Return to sign in</Link>}
  </AuthShell>;
}
