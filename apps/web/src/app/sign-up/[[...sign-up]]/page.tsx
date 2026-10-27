import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetupRequired } from '@/components/setup/setup-required';
import { publicConfig } from '@/lib/config';
import { privateTestAuthEnabled } from '@/server/private-test-auth';
import { AccountForm } from '@/components/auth/account-form';
import { isConfigured } from '@/server/env';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignUpPage() {
  const t = await getTranslations('gateway');
  if (privateTestAuthEnabled() && isConfigured('auth')) return <AuthShell title={t('signUpTitle')} subtitle={t('signUpSubtitle')}><AccountForm mode="sign-up" /></AuthShell>;
  if (!publicConfig.clerkConfigured) return <SetupRequired focus="auth" />;
  return (
    <AuthShell title={t('signUpTitle')} subtitle={t('socialSignUpSubtitle')}>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/onboarding" />
    </AuthShell>
  );
}
