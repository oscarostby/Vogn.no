import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { PublicFrame } from '@/components/shell/public-frame';
import { SetupRequired } from '@/components/setup/setup-required';
import { getEnv, isConfigured } from '@/server/env';
import { currentClerkUserId } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isConfigured('auth')) {
    if (getEnv().TEST_AUTH_ENABLED) return <SetupRequired focus="auth" />;
    return <PublicFrame>{children}</PublicFrame>;
  }
  if (!isConfigured('database')) return <SetupRequired focus="database" />;
  const userId = await currentClerkUserId();
  if (!userId) {
    if (getEnv().TEST_AUTH_ENABLED) redirect('/sign-in');
    return <PublicFrame>{children}</PublicFrame>;
  }
  return <AppShell>{children}</AppShell>;
}
