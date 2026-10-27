import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell/app-shell';
import { SetupRequired } from '@/components/setup/setup-required';
import { isConfigured } from '@/server/env';
import { currentClerkUserId } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isConfigured('auth')) return <SetupRequired focus="auth" />;
  if (!isConfigured('database')) return <SetupRequired focus="database" />;
  const userId = await currentClerkUserId();
  if (!userId) redirect('/sign-in');
  return <AppShell>{children}</AppShell>;
}
