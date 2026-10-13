import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetupRequired } from '@/components/setup/setup-required';
import { publicConfig } from '@/lib/config';
import { privateTestAuthEnabled } from '@/server/private-test-auth';
import { TestSignIn } from '@/components/auth/test-sign-in';
import { isConfigured } from '@/server/env';

export const metadata: Metadata = { title: 'Create your account' };

export default function SignUpPage() {
  if (privateTestAuthEnabled() && isConfigured('auth')) return <AuthShell title="Create a test account" subtitle="Choose a test login name and enter the private test password."><TestSignIn /></AuthShell>;
  if (!publicConfig.clerkConfigured) return <SetupRequired focus="auth" />;
  return (
    <AuthShell title="Join VOGN" subtitle="Free forever. Use Apple, Google or email.">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </AuthShell>
  );
}
