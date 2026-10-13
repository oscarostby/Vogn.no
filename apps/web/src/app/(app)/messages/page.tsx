'use client';

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { MessagesSquare, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/display';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { useDebounced, useProfile } from '@/lib/hooks';

export default function MessagesPage() {
  const router = useRouter();
  const me = useProfile();
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const conversations = useInfiniteQuery({ queryKey: queryKeys.conversations, queryFn: ({ pageParam }) => api.conversations.list({ kind: 'dm', cursor: pageParam }), initialPageParam: undefined as string | undefined, getNextPageParam: (last) => last.nextCursor ?? undefined, refetchInterval: 10_000 });
  const users = useQuery({ queryKey: ['message-recipients', q], queryFn: () => api.search(q, 'users'), enabled: q.length >= 2 });
  const create = useMutation({ mutationFn: (userId: string) => api.conversations.createDm({ userIds: [userId] }), onSuccess: (conversation) => router.push(`/messages/${conversation.id}`) });
  const items = conversations.data?.pages.flatMap((page) => page.items) ?? [];
  return <PageContainer width="narrow">
    <PageHeader title="Messages" description="Private conversations with people in the VOGN community." />
    <section className="mb-6 rounded-xl border border-line bg-surface p-4"><label htmlFor="message-recipient" className="mb-2 block text-sm font-semibold">Start a conversation</label><div className="relative"><Search className="absolute top-3 left-3 size-4 text-subtle" /><Input id="message-recipient" className="pl-9" placeholder="Search by name or username…" value={search} maxLength={80} onChange={(event) => setSearch(event.target.value)} /></div>
      {q.length >= 2 && <div className="mt-3 grid gap-1">{users.isPending ? <ListSkeleton rows={2} /> : users.error ? <ErrorState error={users.error} onRetry={() => void users.refetch()} /> : users.data?.users.filter((user) => user.id !== me?.id).length ? users.data.users.filter((user) => user.id !== me?.id).map((user) => <button key={user.id} type="button" disabled={create.isPending} onClick={() => create.mutate(user.id)} className="flex items-center gap-3 rounded-lg p-2 text-left transition hover:bg-elevated disabled:opacity-50"><Avatar name={user.displayName} image={user.avatar} /><span className="grid"><span className="text-sm font-medium">{user.displayName}</span><span className="text-xs text-muted">@{user.username}</span></span><span className="ml-auto text-xs text-accent-text">Message</span></button>) : <p className="p-3 text-sm text-muted">No people found. They need to create an account first.</p>}</div>}
      {create.error && <ErrorState error={create.error} className="mt-3" />}
    </section>
    {conversations.isPending ? <ListSkeleton rows={5} /> : conversations.error ? <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} /> : items.length ? <div className="grid gap-2">{items.map((conversation) => <Link key={conversation.id} href={`/messages/${conversation.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong"><Avatar name={conversation.title} image={conversation.members[0]?.avatar} accent={conversation.members[0]?.accentColor} size="lg" /><div className="grid min-w-0 flex-1 gap-1"><p className="truncate font-semibold">{conversation.title}</p><p className="truncate text-sm text-muted">{conversation.lastMessage?.text || 'No messages yet'}</p></div>{conversation.unreadCount > 0 && <Badge tone="accent">{conversation.unreadCount}</Badge>}</Link>)}{conversations.hasNextPage && <Button variant="secondary" loading={conversations.isFetchingNextPage} onClick={() => void conversations.fetchNextPage()}>Load more conversations</Button>}</div> : <EmptyState icon={MessagesSquare} title="No conversations yet" description="Find a person above to send your first message." />}
  </PageContainer>;
}
