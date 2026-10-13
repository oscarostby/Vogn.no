'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Car, Compass, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { BuildCard, CrewCard } from '@/components/app/cards';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';

function DiscoverContent() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'builds' ? 'builds' : 'crews');
  const [search, setSearch] = useState('');
  const [make, setMake] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState('trending');
  const q = useDebounced(search.trim());
  const makeFilter = useDebounced(make.trim());
  const crewFilters = { q: q || undefined, country: country || undefined, sort };
  const buildFilters = { make: makeFilter || undefined, country: country || undefined };
  const crews = useInfiniteQuery({ queryKey: queryKeys.discoverCrews(crewFilters), queryFn: ({ pageParam }) => api.discover.crews({ ...crewFilters, cursor: pageParam }), initialPageParam: undefined as string | undefined, getNextPageParam: (page) => page.nextCursor ?? undefined, enabled: tab === 'crews' });
  const builds = useInfiniteQuery({ queryKey: queryKeys.discoverBuilds(buildFilters), queryFn: ({ pageParam }) => api.discover.builds({ ...buildFilters, cursor: pageParam }), initialPageParam: undefined as string | undefined, getNextPageParam: (page) => page.nextCursor ?? undefined, enabled: tab === 'builds' });
  const active = tab === 'crews' ? crews : builds;
  const crewItems = crews.data?.pages.flatMap((page) => page.items) ?? [];
  const buildItems = builds.data?.pages.flatMap((page) => page.items) ?? [];
  return <PageContainer>
    <PageHeader title="Discover" description="Find your people and follow the builds they are working on." actions={<Button asChild><Link href="/crews/new"><Plus aria-hidden="true" />Create crew</Link></Button>} />
    <Tabs value={tab} onValueChange={setTab} className="mb-6"><TabsList><TabsTrigger value="crews"><Compass />Crews</TabsTrigger><TabsTrigger value="builds"><Car />Builds</TabsTrigger></TabsList></Tabs>
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_160px_180px]">
      {tab === 'crews' ? <Field label="Search crews">{(p) => <div className="relative"><Search className="absolute top-3 left-3 size-4 text-muted" aria-hidden="true" /><Input {...p} value={search} maxLength={80} onChange={(e) => setSearch(e.target.value)} placeholder="Name, brand or interest" className="pl-10" /></div>}</Field> : <Field label="Car make">{(p) => <Input {...p} value={make} maxLength={40} onChange={(e) => setMake(e.target.value)} placeholder="e.g. BMW" />}</Field>}
      <Field label="Country">{(p) => <NativeSelect {...p} value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Everywhere</option><option value="NO">Norway</option><option value="SE">Sweden</option><option value="DK">Denmark</option><option value="DE">Germany</option><option value="GB">United Kingdom</option><option value="US">United States</option><option value="JP">Japan</option></NativeSelect>}</Field>
      {tab === 'crews' && <Field label="Sort">{(p) => <NativeSelect {...p} value={sort} onChange={(e) => setSort(e.target.value)}><option value="trending">Trending</option><option value="members">Most members</option><option value="new">Newest</option></NativeSelect>}</Field>}
    </div>
    {active.isLoading && <ListSkeleton rows={6} />}
    {active.error && <ErrorState error={active.error} onRetry={() => void active.refetch()} />}
    {tab === 'crews' && !crews.isLoading && !crews.error && (crewItems.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{crewItems.map((crew) => <CrewCard key={crew.id} crew={crew} />)}</div> : <EmptyState icon={Compass} title="No crews found" description="Try another search, or create the first crew." action={<Button asChild variant="secondary"><Link href="/crews/new">Create a crew</Link></Button>} />)}
    {tab === 'builds' && !builds.isLoading && !builds.error && (buildItems.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{buildItems.map((item) => <BuildCard key={item.vehicle.id} item={item} />)}</div> : <EmptyState icon={Car} title="No public builds found" description="Add a car to your garage and set its visibility to public to share it here." action={<Button asChild variant="secondary"><Link href="/garage/new">Add a car</Link></Button>} />)}
    {active.hasNextPage && <div className="mt-6 text-center"><Button variant="secondary" loading={active.isFetchingNextPage} onClick={() => void active.fetchNextPage()}>Load more</Button></div>}
  </PageContainer>;
}

export default function DiscoverPage() {
  return <Suspense fallback={<PageContainer><ListSkeleton rows={6} /></PageContainer>}><DiscoverContent /></Suspense>;
}
