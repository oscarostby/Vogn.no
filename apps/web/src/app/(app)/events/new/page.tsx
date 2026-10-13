'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventCreateInput } from '@vogn/validation';
import { CalendarDays } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton, PageHeader, useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { useMyCrews } from '@/lib/hooks';

function NewEventContent() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const crews = useMyCrews();
  const [selected, setSelected] = useState(params.get('crewId') ?? '');
  const crew = crews.data?.find((item) => item.id === selected) ?? crews.data?.[0];
  const access = useQuery({ queryKey: queryKeys.crew(crew?.slug ?? ''), queryFn: () => api.crews.get(crew!.slug), enabled: Boolean(crew) });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [timezone, setTimezone] = useState('Europe/Oslo');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'crew' | 'private'>('crew');
  const [locationVisibility, setLocationVisibility] = useState<'public' | 'members' | 'attendees'>('members');
  const [limit, setLimit] = useState('');
  const create = useMutation({ mutationFn: (input: EventCreateInput) => api.events.create(input), onSuccess: (event) => { void qc.invalidateQueries({ queryKey: ['events'] }); void qc.invalidateQueries({ queryKey: queryKeys.home }); toast.success('Event created'); router.push(`/events/${event.id}`); }, onError: (error) => toast.error(errorMessage(error)) });
  if (crews.isLoading) return <PageContainer width="narrow"><ListSkeleton /></PageContainer>;
  if (crews.error) return <PageContainer width="narrow"><ErrorState error={crews.error} onRetry={() => void crews.refetch()} /></PageContainer>;
  if (!crews.data?.length) return <PageContainer width="narrow"><PageHeader title="Create event" /><EmptyState icon={CalendarDays} title="A crew is needed first" description="Create a crew or ask a crew owner for permission to manage events." action={<Button asChild><Link href="/crews/new">Create crew</Link></Button>} /></PageContainer>;
  const canManage = access.data?.viewer.permissions.includes('MANAGE_EVENTS');
  return <PageContainer width="narrow">
    <PageHeader title="Create event" description="Publish a meet or drive for your crew. The server checks your event permissions." />
    <form className="grid gap-5 rounded-xl border border-line bg-surface p-5" onSubmit={(e) => { e.preventDefault(); if (!crew) return; create.mutate({ crewId: crew.id, title, description: description || null, startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null, timezone, city: city || null, visibility, locationVisibility, attendeeListVisibility: 'members', location: location ? { name: location, city: city || null, address: null, latitude: null, longitude: null, notes: null } : null, rsvpLimit: limit ? Number(limit) : null }); }}>
      <Field label="Crew">{(p) => <NativeSelect {...p} value={crew?.id ?? ''} onChange={(e) => setSelected(e.target.value)}>{crews.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect>}</Field>
      {access.error && <ErrorState error={access.error} onRetry={() => void access.refetch()} />}
      {access.data && !canManage && <p role="alert" className="text-sm text-warning">You need Manage Events permission in this crew. Select a crew you manage or ask its owner.</p>}
      <Field label="Title">{(p) => <Input {...p} required minLength={3} maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday cars & coffee" />}</Field>
      <Field label="Description" optional>{(p) => <Textarea {...p} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Start" help="Enter the time in your device's local timezone.">{(p) => <Input {...p} required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}</Field><Field label="End" optional>{(p) => <Input {...p} type="datetime-local" min={startsAt || undefined} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />}</Field></div>
      <Field label="Event display timezone" help="Used to display the date to other members.">{(p) => <NativeSelect {...p} value={timezone} onChange={(e) => setTimezone(e.target.value)}><option value="Europe/Oslo">Europe/Oslo</option><option value="Europe/Stockholm">Europe/Stockholm</option><option value="Europe/Copenhagen">Europe/Copenhagen</option><option value="Europe/Berlin">Europe/Berlin</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option><option value="America/Los_Angeles">America/Los_Angeles</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="UTC">UTC</option></NativeSelect>}</Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="City" optional>{(p) => <Input {...p} value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />}</Field><Field label="Meeting place" optional>{(p) => <Input {...p} value={location} maxLength={120} onChange={(e) => setLocation(e.target.value)} />}</Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Event visibility">{(p) => <NativeSelect {...p} value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}><option value="crew">Crew members</option><option value="public">Public</option><option value="private">Organizers only</option></NativeSelect>}</Field><Field label="Meeting place visibility">{(p) => <NativeSelect {...p} value={locationVisibility} onChange={(e) => setLocationVisibility(e.target.value as typeof locationVisibility)}><option value="members">Crew members</option><option value="attendees">Going attendees</option><option value="public">Public</option></NativeSelect>}</Field></div>
      <Field label="Attendance limit" optional help="Full events place new attendees on a waitlist.">{(p) => <Input {...p} type="number" min={1} max={100000} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Unlimited" />}</Field>
      <div className="flex justify-end gap-2"><Button asChild variant="ghost"><Link href="/events">Cancel</Link></Button><Button type="submit" loading={create.isPending} disabled={!canManage}>Create event</Button></div>
    </form>
  </PageContainer>;
}

export default function NewEventPage() {
  return <Suspense fallback={<PageContainer><ListSkeleton /></PageContainer>}><NewEventContent /></Suspense>;
}
