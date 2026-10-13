'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatRelative } from '@vogn/utils';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/display';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { cn } from '@/lib/cn';

export default function NotificationsPage() {
  const locale = useLocale();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const notifications = useInfiniteQuery({ queryKey: queryKeys.notifications, queryFn: ({ pageParam }) => api.notifications.list(pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: (page) => page.nextCursor ?? undefined });
  const read = useMutation({ mutationFn: (input: { ids: string[] } | { all: true }) => api.notifications.markRead(input), onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.notifications }); void qc.invalidateQueries({ queryKey: queryKeys.unread }); }, onError: (error) => toast.error(errorMessage(error)) });
  const items = notifications.data?.pages.flatMap((page) => page.items) ?? [];
  return <PageContainer width="narrow">
    <PageHeader title="Notifications" description="Updates from your crews and community." actions={<Button variant="secondary" size="sm" loading={read.isPending} disabled={!items.some((item) => !item.readAt)} onClick={() => read.mutate({ all: true })}><CheckCheck />Mark all read</Button>} />
    {notifications.isLoading && <ListSkeleton rows={6} />}
    {notifications.error && <ErrorState error={notifications.error} onRetry={() => void notifications.refetch()} />}
    {!notifications.isLoading && !notifications.error && (items.length ? <div className="grid gap-2">{items.map((item) => <article key={item.id} className={cn('flex items-start gap-3 rounded-xl border border-line p-4', item.readAt ? 'bg-surface' : 'bg-elevated')}>
      {item.actor ? <Avatar name={item.actor.displayName} image={item.actor.avatar} size="md" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken"><Bell className="size-4 text-muted" /></span>}
      <div className="grid min-w-0 flex-1 gap-1">{item.link?.startsWith('/') && !item.link.startsWith('//') ? <Link href={item.link} onClick={() => { if (!item.readAt) read.mutate({ ids: [item.id] }); }} className="text-sm font-semibold hover:underline">{item.title}</Link> : <p className="text-sm font-semibold">{item.title}</p>}{item.body && <p className="text-sm text-muted">{item.body}</p>}<time dateTime={item.createdAt} className="text-xs text-subtle">{formatRelative(item.createdAt, locale)}</time></div>
      {!item.readAt && <Button size="xs" variant="ghost" disabled={read.isPending} onClick={() => read.mutate({ ids: [item.id] })}>Mark read</Button>}
    </article>)}</div> : <EmptyState icon={Bell} title="You're all caught up" description="New notifications will appear here." />)}
    {notifications.hasNextPage && <div className="mt-6 text-center"><Button variant="secondary" loading={notifications.isFetchingNextPage} onClick={() => void notifications.fetchNextPage()}>Load more</Button></div>}
  </PageContainer>;
}
