import { CrewStudio } from '@/components/studio/crew-studio';
export default async function StudioPage({ params }: { params: Promise<{ slug: string }> }) {
  return <CrewStudio slug={(await params).slug} />;
}
