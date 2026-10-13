import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { PublicFrame } from '@/components/shell/public-frame';
import { SetupRequired } from '@/components/setup/setup-required';
import { isConfigured } from '@/server/env';
import { currentClerkUserId } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!isConfigured('auth')) {
    return <PublicFrame>{children}</PublicFrame>;
  }
  if (!isConfigured('database')) return <SetupRequired focus="database" />;
  const userId = await currentClerkUserId();
  if (!userId) return <PublicFrame>{children}</PublicFrame>;
  return <AppShell>{children}</AppShell>;
}
