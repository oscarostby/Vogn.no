import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetupRequired } from '@/components/setup/setup-required';
import { publicConfig } from '@/lib/config';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  if (!publicConfig.clerkConfigured) return <SetupRequired focus="auth" />;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in with Apple, Google or email.">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/home" />
    </AuthShell>
  );
}
