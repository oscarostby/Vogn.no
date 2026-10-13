'use client';

import { useQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/app/page';
import { ChatPanel } from '@/components/chat/chat-panel';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { ChannelList } from './channel-list';

export function CrewChannelView({ slug, channelId }: { slug: string; channelId: string }) {
  const crew = useQuery({ queryKey: queryKeys.crew(slug), queryFn: () => api.crews.get(slug) });
  const channels = useQuery({ queryKey: queryKeys.crewChannels(crew.data?.id ?? ''), queryFn: () => api.crews.channels(crew.data!.id), enabled: Boolean(crew.data) });
  if (crew.isPending || (crew.data && channels.isPending)) return <PageContainer><ListSkeleton rows={6} /></PageContainer>;
  if (crew.error || channels.error) return <PageContainer><ErrorState error={crew.error ?? channels.error} onRetry={() => { void crew.refetch(); void channels.refetch(); }} /></PageContainer>;
  const channel = channels.data?.find((item) => item.id === channelId);
  if (!channel?.conversationId) return <PageContainer><EmptyState title="Channel unavailable" description="The channel may have been removed, or you may not have access." /></PageContainer>;
  return <PageContainer width="wide"><div className="grid overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-[220px_minmax(0,1fr)]">
    <aside className="hidden border-r border-line p-3 lg:block"><Link href={`/c/${slug}`} className="mb-3 block px-3 py-2 font-semibold hover:text-accent-text">{crew.data?.name}</Link><ChannelList channels={channels.data ?? []} slug={slug} activeId={channel.id} /></aside>
    <section className="min-w-0"><header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3"><Link href={`/c/${slug}`} className="mr-auto text-xs text-muted hover:text-fg">{crew.data?.name}</Link><Hash className="size-4 text-muted" /><h1 className="font-semibold">{channel.name}</h1>{channel.topic && <p className="w-full text-xs text-muted">{channel.topic}</p>}</header><ChatPanel key={channel.conversationId} conversationId={channel.conversationId} canSend={channel.viewer.canSend} canManage={channel.viewer.canManage} canUpload={channel.viewer.canUpload} /></section>
  </div></PageContainer>;
}
