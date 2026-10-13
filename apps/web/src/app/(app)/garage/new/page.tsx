'use client';

import { useTranslations } from 'next-intl';
import { PageContainer } from '@/components/app/page';
import { VehicleEditor } from '@/components/garage/vehicle-editor';
import { PageHeader } from '@/components/ui/states';

export default function NewVehiclePage() {
  const t = useTranslations('garage');
  return (
    <PageContainer>
      <PageHeader eyebrow={t('title')} title={t('addVehicle')} description="Start with the basics — you can add photos, modifications and build updates next." />
      <VehicleEditor />
    </PageContainer>
  );
}
