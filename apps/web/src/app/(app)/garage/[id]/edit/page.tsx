'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageContainer } from '@/components/app/page';
import { GalleryManager } from '@/components/garage/gallery-manager';
import { ModificationsEditor } from '@/components/garage/modifications-editor';
import { VehicleEditor } from '@/components/garage/vehicle-editor';
import { ErrorState, ListSkeleton, PageHeader } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';

export default function EditVehiclePage() {
  const t = useTranslations('garage');
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: queryKeys.vehicle(id), queryFn: () => api.vehicles.get(id) });
  return (
    <PageContainer>
      <PageHeader eyebrow={t('title')} title={data ? `${data.make} ${data.model}` : t('editVehicle')} />
      {isLoading && <ListSkeleton />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}
      {data && !data.viewer.isOwner && <ErrorState error={new Error('forbidden')} />}
      {data?.viewer.isOwner && (
        <div className="grid gap-6">
          <GalleryManager vehicle={data} />
          <ModificationsEditor vehicle={data} />
          <VehicleEditor vehicle={data} />
        </div>
      )}
    </PageContainer>
  );
}
