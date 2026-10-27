import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetupRequired } from '@/components/setup/setup-required';
import { publicConfig } from '@/lib/config';
import { privateTestAuthEnabled } from '@/server/private-test-auth';
import { AccountForm } from '@/components/auth/account-form';
import { isConfigured } from '@/server/env';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage() {
  const t = await getTranslations('gateway');
  if (privateTestAuthEnabled() && isConfigured('auth')) return <AuthShell title={t('signInTitle')} subtitle={t('signInSubtitle')}><AccountForm mode="sign-in" /></AuthShell>;
  if (!publicConfig.clerkConfigured) return <SetupRequired focus="auth" />;
  return (
    <AuthShell title={t('signInTitle')} subtitle={t('socialSignInSubtitle')}>
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/home" />
    </AuthShell>
  );
}
