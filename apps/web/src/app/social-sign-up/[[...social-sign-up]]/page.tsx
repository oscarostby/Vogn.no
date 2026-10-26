import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { clerkAuthConfigured } from '@/server/env';

export default function SocialSignUpPage() {
  return <AuthShell title="Finish creating your account" subtitle="Complete your sign-up with Apple or Google.">
    {clerkAuthConfigured() ? <SignUp path="/social-sign-up" routing="path" signInUrl="/social-sign-in" fallbackRedirectUrl="/onboarding" /> : <Link href="/sign-up" className="text-accent-text">Return to create an account</Link>}
  </AuthShell>;
}
