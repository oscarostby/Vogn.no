import type { Metadata } from 'next';
import { VehicleView } from './vehicle-view';

export const metadata: Metadata = { title: 'Build' };

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleView id={id} />;
}
