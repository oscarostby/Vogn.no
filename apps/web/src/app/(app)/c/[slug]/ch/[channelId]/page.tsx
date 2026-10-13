import { CrewChannelView } from '@/components/crews/crew-channel-view';

export default async function CrewChannelPage({ params }: { params: Promise<{ slug: string; channelId: string }> }) {
  const { slug, channelId } = await params;
  return <CrewChannelView slug={slug} channelId={channelId} />;
}
