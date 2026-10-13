import type { Metadata } from 'next';
import { SetupRequired } from '@/components/setup/setup-required';

export const metadata: Metadata = { title: 'Configuration required', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default function SetupRequiredPage() {
  return <SetupRequired focus="auth" />;
}
