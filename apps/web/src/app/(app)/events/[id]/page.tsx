'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventDetail } from '@vogn/types';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageContainer, SectionTitle } from '@/components/app/page';
import { ReportDialog } from '@/components/app/report-dialog';
import { Markdown } from '@/components/content/markdown';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/display';
import { ErrorState, ListSkeleton, PageHeader, useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { mediaUrl } from '@/lib/media';

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [showAttendees, setShowAttendees] = useState(false);
  const [report, setReport] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const event = useQuery({ queryKey: queryKeys.event(id), queryFn: () => api.events.get(id) });
  const attendees = useQuery({ queryKey: ['event', id, 'attendees'], queryFn: () => api.events.attendees(id), enabled: showAttendees });
  const refresh = (updated: EventDetail) => { qc.setQueryData(queryKeys.event(id), updated); void qc.invalidateQueries({ queryKey: ['events'] }); void qc.invalidateQueries({ queryKey: ['event', id, 'attendees'] }); void qc.invalidateQueries({ queryKey: queryKeys.home }); };
  const rsvp = useMutation({ mutationFn: (status: 'going' | 'interested' | 'not_going') => api.events.rsvp(id, status), onSuccess: refresh, onError: (error) => toast.error(errorMessage(error)) });
  const cancel = useMutation({ mutationFn: () => api.events.update(id, { status: 'cancelled', announce: true }), onSuccess: (updated) => { refresh(updated); toast.success('Event cancelled. Attendees have been notified.'); }, onError: (error) => toast.error(errorMessage(error)) });
  if (event.isLoading) return <PageContainer width="narrow"><ListSkeleton rows={6} /></PageContainer>;
  if (event.error || !event.data) return <PageContainer width="narrow"><ErrorState error={event.error} onRetry={() => void event.refetch()} /></PageContainer>;
  const data = event.data;
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short', timeZone: data.timezone }).format(new Date(value));
  const ended = new Date(data.endsAt ?? data.startsAt).getTime() + (data.endsAt ? 0 : 12 * 3600000) < openedAt;
  const rsvpDisabled = rsvp.isPending || data.status === 'cancelled' || ended;
  return <PageContainer width="narrow">
    <Link href="/events" className="mb-4 inline-block text-sm text-muted hover:text-fg">← Events</Link>
    {data.coverImage && <div className="mb-5 overflow-hidden rounded-xl"><Image src={mediaUrl(data.coverImage, { width: 1200, height: 500, crop: 'fill' })} alt="" width={1200} height={500} unoptimized className="aspect-[12/5] w-full object-cover" /></div>}
    <PageHeader title={data.title} eyebrow={<Link href={`/c/${data.crew.slug}`}>{data.crew.name}</Link>} actions={<Badge tone={data.status === 'cancelled' ? 'danger' : 'accent'}>{data.status === 'cancelled' ? 'Cancelled' : ended ? 'Ended' : 'Scheduled'}</Badge>} />
    <div className="grid gap-6 rounded-xl border border-line bg-surface p-5">
      <div className="grid gap-3 text-sm"><p className="flex gap-3"><CalendarDays className="mt-0.5 size-5 shrink-0 text-muted" /><span>{date(data.startsAt)}{data.endsAt && <span className="block text-muted">Until {date(data.endsAt)}</span>}<span className="block text-xs text-muted">{data.timezone}</span></span></p><p className="flex gap-3"><MapPin className="size-5 shrink-0 text-muted" /><span>{data.location ? [data.location.name, data.location.address, data.location.city].filter(Boolean).join(', ') : data.city ?? 'Meeting place not set'}{data.locationHidden && <span className="block text-xs text-muted">The exact meeting place is visible to {data.locationVisibility === 'attendees' ? 'attendees marked as going' : 'crew members'}.</span>}{data.location?.notes && <span className="block text-muted">{data.location.notes}</span>}</span></p></div>
      {data.description && <Markdown text={data.description} />}
      {data.safetyNotes && <div className="rounded-lg border border-line bg-sunken p-3"><p className="mb-1 text-sm font-semibold">Before you go</p><p className="text-sm whitespace-pre-wrap text-muted">{data.safetyNotes}</p></div>}
      <div className="grid gap-3 border-t border-line pt-4"><p className="text-sm"><strong>{data.goingCount}</strong> going · <strong>{data.interestedCount}</strong> interested{data.rsvpLimit && ` · ${data.rsvpLimit} places`}</p>{data.viewerRsvp && <p className="text-sm text-accent-text">Your RSVP: {data.viewerRsvp.replace('_', ' ')}</p>}<div className="flex flex-wrap gap-2"><Button variant={data.viewerRsvp === 'going' ? 'primary' : 'secondary'} disabled={rsvpDisabled} onClick={() => rsvp.mutate('going')}>Going</Button><Button variant={data.viewerRsvp === 'interested' ? 'primary' : 'secondary'} disabled={rsvpDisabled} onClick={() => rsvp.mutate('interested')}>Interested</Button><Button variant="ghost" disabled={rsvpDisabled} onClick={() => rsvp.mutate('not_going')}>Can&apos;t go</Button></div>{data.viewerRsvp === 'waitlist' && <p className="text-xs text-muted">You&apos;re on the waitlist. A place is assigned when an attendee leaves.</p>}</div>
      <div className="flex flex-wrap gap-3 text-sm"><a href={api.events.icsUrl(id)} className="text-accent-text hover:underline">Download calendar event</a><a href={data.calendar.googleUrl} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:underline">Add to Google Calendar</a><button type="button" className="text-muted hover:text-fg" onClick={() => setReport(true)}>Report event</button></div>
      {data.organizer && <div className="flex items-center gap-2 text-sm text-muted"><Avatar name={data.organizer.displayName} image={data.organizer.avatar} size="sm" />Organized by <Link href={`/u/${data.organizer.username}`} className="text-fg hover:underline">{data.organizer.displayName}</Link></div>}
      {data.canManage && data.status !== 'cancelled' && <div className="border-t border-line pt-4"><Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => { if (window.confirm('Cancel this event and notify all attendees?')) cancel.mutate(); }}>Cancel event</Button></div>}
    </div>
    <section className="mt-6"><SectionTitle title="Attendees" action={<Button variant="ghost" size="sm" onClick={() => setShowAttendees(!showAttendees)}><Users />{showAttendees ? 'Hide' : 'Show attendees'}</Button>} />{showAttendees && <>{attendees.isLoading && <ListSkeleton />}{attendees.error && <ErrorState error={attendees.error} onRetry={() => void attendees.refetch()} />}{attendees.data && <div className="grid gap-2">{attendees.data.length ? attendees.data.map((item) => <Link key={item.user.id} href={`/u/${item.user.username}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"><Avatar name={item.user.displayName} image={item.user.avatar} size="sm" /><span className="flex-1 text-sm font-medium">{item.user.displayName}</span><Badge>{item.status}</Badge></Link>) : <p className="text-sm text-muted">No RSVPs yet.</p>}</div>}</>}</section>
    <ReportDialog open={report} onOpenChange={setReport} targetType="event" targetId={id} label="event" />
  </PageContainer>;
}
