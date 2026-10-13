'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, BellOff, Users } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/display';
import { ErrorState, ListSkeleton } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { ChatPanel } from './chat-panel';

export function ConversationView({ id }: { id: string }) {
  const conversation = useQuery({ queryKey: queryKeys.conversation(id), queryFn: () => api.conversations.get(id) });
  const mute = useMutation({ mutationFn: () => api.conversations.mute(id, !conversation.data?.muted), onSuccess: () => void conversation.refetch() });
  if (conversation.isPending) return <PageContainer><ListSkeleton rows={5} /></PageContainer>;
  if (conversation.error || !conversation.data) return <PageContainer><ErrorState error={conversation.error} onRetry={() => void conversation.refetch()} /></PageContainer>;
  const data = conversation.data;
  return <PageContainer width="narrow">
    <div className="overflow-hidden rounded-xl border border-line bg-surface"><header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3"><Button asChild variant="ghost" size="icon-sm"><Link href="/messages" aria-label="All messages"><ArrowLeft /></Link></Button><Avatar name={data.title} image={data.members[0]?.avatar} /><div className="grid min-w-0 flex-1"><h1 className="truncate font-semibold">{data.title}</h1><p className="text-xs text-muted">{data.members.map((member) => `@${member.username}`).join(', ')}</p></div>{data.kind === 'group_dm' && <Badge><Users /> {data.memberCount}</Badge>}{(data.kind === 'dm' || data.kind === 'group_dm') && <Button variant="ghost" size="sm" loading={mute.isPending} onClick={() => mute.mutate()}><BellOff /> {data.muted ? 'Unmute' : 'Mute'}</Button>}</header>{mute.error && <ErrorState error={mute.error} />}<ChatPanel key={id} conversationId={id} /></div>
  </PageContainer>;
}
