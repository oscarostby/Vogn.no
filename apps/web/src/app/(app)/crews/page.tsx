'use client';

import { Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { CrewCard } from '@/components/app/cards';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/states';
import { useMyCrews } from '@/lib/hooks';

export default function CrewsPage() {
  const crews = useMyCrews();
  return (
    <PageContainer>
      <PageHeader title="Your crews" description="Your communities, channels and shared builds." actions={<Button asChild><Link href="/crews/new"><Plus /> Create crew</Link></Button>} />
      {crews.isPending ? <ListSkeleton /> : crews.error ? <ErrorState error={crews.error} onRetry={() => void crews.refetch()} /> : crews.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{crews.data.map((crew) => <CrewCard key={crew.id} crew={crew} />)}</div>
      ) : <EmptyState icon={Users} title="Find your people" description="Join a crew or start a community of your own." action={<Button asChild variant="secondary"><Link href="/discover">Discover crews</Link></Button>} />}
    </PageContainer>
  );
}
