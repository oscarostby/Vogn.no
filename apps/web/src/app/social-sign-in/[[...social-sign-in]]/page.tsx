import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { clerkAuthConfigured } from '@/server/env';

export default function SocialSignInPage() {
  return <AuthShell title="Continue signing in" subtitle="Finish signing in with your connected account.">
    {clerkAuthConfigured() ? <SignIn path="/social-sign-in" routing="path" signUpUrl="/social-sign-up" fallbackRedirectUrl="/home" /> : <Link href="/sign-in" className="text-accent-text">Return to sign in</Link>}
  </AuthShell>;
}
