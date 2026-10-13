'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { CalendarDays, Plus } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { EventRowCard } from '@/components/app/cards';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/controls';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';

export default function EventsPage() {
  const locale = useLocale();
  const [scope, setScope] = useState<'upcoming' | 'mine' | 'past'>('upcoming');
  const events = useInfiniteQuery({ queryKey: queryKeys.events(scope), queryFn: ({ pageParam }) => api.events.list({ scope, cursor: pageParam }), initialPageParam: undefined as string | undefined, getNextPageParam: (page) => page.nextCursor ?? undefined });
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];
  return <PageContainer>
    <PageHeader title="Events" description="Car meets, drives and days in the garage with your crew." actions={<Button asChild><Link href="/events/new"><Plus aria-hidden="true" />Create event</Link></Button>} />
    <Tabs value={scope} onValueChange={(value) => setScope(value as typeof scope)} className="mb-6"><TabsList><TabsTrigger value="upcoming">Upcoming</TabsTrigger><TabsTrigger value="mine">My RSVPs</TabsTrigger><TabsTrigger value="past">Past</TabsTrigger></TabsList></Tabs>
    {events.isLoading && <ListSkeleton rows={6} />}
    {events.error && <ErrorState error={events.error} onRetry={() => void events.refetch()} />}
    {!events.isLoading && !events.error && (items.length ? <div className="grid gap-3">{items.map((event) => <EventRowCard key={event.id} event={event} locale={locale} />)}</div> : <EmptyState icon={CalendarDays} title="No events here yet" description={scope === 'mine' ? 'RSVP to an event to see it here.' : 'Create an event for a crew you manage.'} action={<Button asChild variant="secondary"><Link href={scope === 'mine' ? '/events' : '/events/new'}>{scope === 'mine' ? 'Browse events' : 'Create event'}</Link></Button>} />)}
    {events.hasNextPage && <div className="mt-6 text-center"><Button variant="secondary" loading={events.isFetchingNextPage} onClick={() => void events.fetchNextPage()}>Load more</Button></div>}
  </PageContainer>;
}
