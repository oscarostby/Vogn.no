import type { Metadata } from 'next';
import { SetupRequired } from '@/components/setup/setup-required';
import { isConfigured } from '@/server/env';
import { requireSignedIn } from '@/server/session';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Set up your profile', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  if (!isConfigured('auth') || !isConfigured('database')) return <SetupRequired focus="auth" />;
  await requireSignedIn('/onboarding');
  return <OnboardingForm />;
}
