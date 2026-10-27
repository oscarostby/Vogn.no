import type { BuildFeedItem, CrewSummary, EventSummary, VehicleSummary } from '@vogn/types';
import { compactNumber, countryFlag } from '@vogn/utils';
import { CalendarDays, Car, Gauge, Heart, MapPin, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { Avatar, Badge } from '@/components/ui/display';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media';

export function VehicleCard({ vehicle, ownerName, href, className }: { vehicle: VehicleSummary; ownerName?: string; href?: string; className?: string }) {
  return (
    <Link href={href ?? `/v/${vehicle.id}`} className={cn('group grid overflow-hidden rounded-xl border border-line bg-surface transition hover:border-line-strong', className)}>
      <div className="relative aspect-[4/3] overflow-hidden bg-elevated">
        {vehicle.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(vehicle.coverImage, { width: 640, height: 480, crop: 'fill' })} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex size-full items-center justify-center bg-[linear-gradient(135deg,var(--vogn-elevated),var(--vogn-surface))]">
            <Car className="size-9 text-subtle" aria-hidden="true" />
          </div>
        )}
        {vehicle.verification.specsConfirmed && (
          <Badge tone="info" className="absolute top-2 left-2 backdrop-blur">
            <ShieldCheck aria-hidden="true" /> Specs confirmed
          </Badge>
        )}
      </div>
      <div className="grid gap-1 p-3">
        <p className="truncate font-semibold">
          {vehicle.year ? `${vehicle.year} ` : ''}
          {vehicle.make} {vehicle.model}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted">
          {vehicle.nickname && <span className="truncate">“{vehicle.nickname}”</span>}
          {ownerName && <span className="truncate">{ownerName}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {vehicle.currentHp && (
              <span className="inline-flex items-center gap-1" title="Owner-reported">
                <Gauge className="size-3.5" aria-hidden="true" />
                {vehicle.currentHp} hp
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3.5" aria-hidden="true" />
              {vehicle.likeCount}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function BuildCard({ item }: { item: BuildFeedItem }) {
  return (
    <div className="grid gap-2">
      <VehicleCard vehicle={item.vehicle} />
      <div className="flex items-center gap-2 px-1 text-xs text-muted">
        <Avatar name={item.owner.displayName} image={item.owner.avatar} accent={item.owner.accentColor} size="xs" />
        <Link href={`/u/${item.owner.username}`} className="truncate font-medium text-fg hover:underline">
          {item.owner.displayName}
        </Link>
        {item.latestUpdate && <span className="truncate">· {item.latestUpdate.title}</span>}
      </div>
    </div>
  );
}

export function CrewCard({ crew, badge }: { crew: CrewSummary; badge?: string }) {
  return (
    <Link href={`/c/${crew.slug}`} className="group grid overflow-hidden rounded-xl border border-line bg-surface transition hover:border-line-strong">
      <div
        className="relative h-24 overflow-hidden"
        style={{ background: crew.banner ? undefined : `linear-gradient(120deg, color-mix(in srgb, ${crew.accentColor ?? '#A5A9B2'} 45%, transparent), var(--vogn-surface))` }}
      >
        {crew.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(crew.banner, { width: 640, height: 200, crop: 'fill' })} alt="" loading="lazy" className="size-full object-cover" />
        )}
      </div>
      <div className="relative grid gap-2 p-4 pt-0">
        <Avatar name={crew.name} image={crew.icon} shape="rounded" size="lg" accent={crew.accentColor} className="-mt-6 ring-4 ring-surface" />
        <div className="grid gap-0.5">
          <p className="flex items-center gap-2 truncate font-semibold">
            {crew.name}
            {badge && <Badge tone="accent">{badge}</Badge>}
          </p>
          {crew.description && <p className="line-clamp-2 text-sm text-muted">{crew.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            {compactNumber(crew.memberCount)}
          </span>
          {(crew.region || crew.country) && (
            <span>
              {crew.country ? `${countryFlag(crew.country)} ` : ''}
              {crew.region ?? crew.country}
            </span>
          )}
          <span className="uppercase">{crew.language}</span>
          {crew.visibility !== 'public' && <Badge>{crew.visibility === 'application' ? 'Apply' : 'Invite only'}</Badge>}
        </div>
      </div>
    </Link>
  );
}

export function EventRowCard({ event, locale }: { event: EventSummary; locale: string }) {
  const date = new Date(event.startsAt);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: event.timezone }).format(date);
  return (
    <Link href={`/events/${event.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3 transition hover:border-line-strong">
      <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-elevated leading-none">
        <span className="text-lg font-bold">{fmt({ day: '2-digit' })}</span>
        <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">{fmt({ month: 'short' })}</span>
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="truncate font-semibold">{event.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {fmt({ weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          {event.city && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden="true" />
              {event.city}
            </span>
          )}
          <span>{event.crew.name}</span>
        </span>
      </span>
      <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
        <span className="block text-sm font-semibold text-fg">{event.goingCount}</span>
        going
      </span>
      {event.status === 'cancelled' && <Badge tone="danger">Cancelled</Badge>}
      {event.viewerRsvp === 'going' && <Badge tone="accent">Going</Badge>}
    </Link>
  );
}
