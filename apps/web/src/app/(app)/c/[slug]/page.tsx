import { CrewView } from '@/components/crews/crew-view';

export default async function CrewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CrewView slug={slug} />;
}
