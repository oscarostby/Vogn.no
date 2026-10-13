import { InvitationView } from '@/components/crews/invitation-view';

export default async function InvitationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <InvitationView code={code} />;
}
