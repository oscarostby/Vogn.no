import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetupRequired } from '@/components/setup/setup-required';
import { publicConfig } from '@/lib/config';
import { privateTestAuthEnabled } from '@/server/private-test-auth';
import { TestSignIn } from '@/components/auth/test-sign-in';
import { isConfigured } from '@/server/env';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  if (privateTestAuthEnabled() && isConfigured('auth')) return <AuthShell title="Private VOGN test" subtitle="Sign in to your test account."><TestSignIn /></AuthShell>;
  if (!publicConfig.clerkConfigured) return <SetupRequired focus="auth" />;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in with Apple, Google or email.">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/home" />
    </AuthShell>
  );
}
