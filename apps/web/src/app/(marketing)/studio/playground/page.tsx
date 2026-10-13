import Link from 'next/link';
import { StudioShowcase } from '@/components/marketing/studio-showcase';
export default function PlaygroundPage() {
  return <main className="mx-auto max-w-[1400px] px-4 py-10 md:px-8"><h1 className="font-display text-4xl font-semibold">Crew Studio playground</h1><p className="mt-3 mb-8 text-muted">Try the five presets with fictional sample content. To save and publish your own theme, create a crew and open its Crew Studio.</p><StudioShowcase /><Link className="mt-8 inline-block text-accent-text hover:underline" href="/crews/new">Create your crew →</Link></main>;
}
