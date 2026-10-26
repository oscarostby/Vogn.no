import Link from 'next/link';
import { VERIFICATION_LEVEL_INFO } from '@vogn/types';
import { PageContainer } from '@/components/app/page';
import { getEnv, isConfigured } from '@/server/env';
import { requireSignedIn } from '@/server/session';

export default async function VerificationPage() {
  await requireSignedIn('/verification');
  const env = getEnv();
  return <PageContainer width="narrow"><h1 className="mb-4 font-display text-3xl font-semibold">Verification</h1><p className="mb-6 text-sm text-muted">{env.TEST_AUTH_ENABLED ? 'Login-name accounts do not have verified email or phone badges. Accounts using Apple or Google can receive verification from their identity provider. Vehicle lookup does not verify ownership.' : 'Verification is available only when the corresponding provider and review workflow are configured.'}</p><div className="grid gap-4">{Object.entries(VERIFICATION_LEVEL_INFO).map(([key, info]) => <section key={key} className="rounded-xl border border-line bg-surface p-5"><h2 className="font-semibold">{info.label}</h2><p className="mt-2 text-sm text-muted">{info.proves}</p><p className="mt-2 text-xs text-muted">{info.doesNotProve}</p></section>)}</div><p className="my-6 text-sm text-muted">Official Norway lookup: {isConfigured('vehicleLookupNO') ? 'Enter a registration number when adding or editing a car to fill in editable details from Statens vegvesen.' : 'Needs a Statens vegvesen API key.'} Private evidence review: {isConfigured('privateStorage') ? 'Storage keys present; the submission/review workflow is not implemented yet.' : 'Needs private R2 storage and the submission/review workflow.'}</p><Link className="text-accent-text hover:underline" href="/garage">Open your garage →</Link></PageContainer>;
}
