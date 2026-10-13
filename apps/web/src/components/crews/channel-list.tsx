import type { CrewChannel } from '@vogn/types';
import { Hash, Lock, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/display';
import { cn } from '@/lib/cn';

export function ChannelList({ channels, slug, activeId }: { channels: CrewChannel[]; slug: string; activeId?: string }) {
  return <div className="grid gap-1">{channels.map((channel) => channel.type === 'category' ? (
    <p key={channel.id} className="mt-4 px-3 text-xs font-semibold tracking-wider text-subtle uppercase">{channel.name}</p>
  ) : channel.conversationId ? (
    <Link key={channel.id} href={`/c/${slug}/ch/${channel.id}`} className={cn('flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted transition hover:bg-elevated hover:text-fg', activeId === channel.id && 'bg-elevated font-semibold text-fg')}>
      {channel.locked ? <Lock className="size-4 shrink-0" /> : <Hash className="size-4 shrink-0" />}
      <span className="truncate">{channel.name}</span>
      {channel.viewer.unreadCount > 0 && <Badge className="ml-auto" tone="accent">{channel.viewer.unreadCount}</Badge>}
    </Link>
  ) : <div key={channel.id} className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted"><Volume2 className="size-4" /><span>{channel.name}</span><Badge className="ml-auto">Voice unavailable</Badge></div>)}</div>;
}
