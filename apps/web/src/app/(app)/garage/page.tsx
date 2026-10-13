'use client';

import { useQuery } from '@tanstack/react-query';
import { Car, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { VehicleCard } from '@/components/app/cards';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { useProfile } from '@/lib/hooks';

export default function GaragePage() {
  const t = useTranslations('garage');
  const me = useProfile();
  const garage = useQuery({ queryKey: queryKeys.garage(me?.username ?? ''), queryFn: () => api.users.garage(me!.username), enabled: Boolean(me) });
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow={t('title')}
        title={t('myGarage')}
        description="Your builds, specs and timelines. Choose per vehicle who can see it."
        actions={
          <Button asChild>
            <Link href="/garage/new">
              <Plus aria-hidden="true" /> {t('addVehicle')}
            </Link>
          </Button>
        }
      />
      {garage.isLoading && <ListSkeleton />}
      {garage.error && <ErrorState error={garage.error} onRetry={() => void garage.refetch()} />}
      {garage.data && garage.data.length === 0 && (
        <EmptyState icon={Car} title={t('empty')} action={<Button asChild><Link href="/garage/new">{t('addVehicle')}</Link></Button>} />
      )}
      {garage.data && garage.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {garage.data.map((v) => (
            <div key={v.id} className="grid gap-1.5">
              <VehicleCard vehicle={v} />
              <p className="px-1 text-xs text-subtle capitalize">{v.visibility === 'crews' ? 'Selected crews' : v.visibility}</p>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
