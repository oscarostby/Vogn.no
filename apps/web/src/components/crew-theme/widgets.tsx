'use client';

import type { PollResult, WidgetDataByType, WidgetPost, WidgetVehicle } from '@vogn/api-client';
import { type ThemeWidget, toVideoEmbedUrl, type WidgetOf } from '@vogn/theme-engine';
import type { EventSummary, UserSummary } from '@vogn/types';
import { compactNumber, formatDate, formatRelative, initials } from '@vogn/utils';
import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight, Gauge, MapPin, MessageCircle, Trophy } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Markdown } from '@/components/content/markdown';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media';
import { ThemeIcon } from './theme-icon';

export interface WidgetRenderContext {
  crewId: string | null;
  crewSlug: string;
  crewName: string;
  crewRules: string[];
  foundedAt: string | null;
  isMember: boolean;
  data: Record<string, unknown>;
  mode: 'live' | 'preview' | 'editor';
  locale: string;
  joinAction?: ReactNode;
}

function dataFor<K extends keyof WidgetDataByType>(ctx: WidgetRenderContext, widget: ThemeWidget): WidgetDataByType[K] | undefined {
  return ctx.data[widget.id] as WidgetDataByType[K] | undefined;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-[var(--ct-muted)]">{children}</p>;
}

function MiniAvatar({ user, size = 28 }: { user: Pick<UserSummary, 'displayName' | 'avatar' | 'accentColor'>; size?: number }) {
  return user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(user.avatar, { width: size * 2, height: size * 2, crop: 'fill' })} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
      style={{ width: size, height: size, background: user.accentColor ?? 'var(--ct-surface-2)', color: 'var(--ct-text)' }}
    >
      {initials(user.displayName)}
    </span>
  );
}

function VehicleTile({ vehicle, large = false, showSpecs = false }: { vehicle: WidgetVehicle; large?: boolean; showSpecs?: boolean }) {
  return (
    <Link href={`/v/${vehicle.id}`} className="ct-card group relative block overflow-hidden" data-interactive="true">
      <div className={cn('relative overflow-hidden bg-[var(--ct-surface-2)]', large ? 'aspect-[16/9]' : 'aspect-[4/3]')}>
        {vehicle.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(vehicle.coverImage, { width: large ? 1200 : 600, crop: 'fill' })}
            alt={`${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[var(--ct-muted)]" style={{ background: 'linear-gradient(135deg, var(--ct-surface-2), var(--ct-surface))' }}>
            <ThemeIcon name="car-front" className="size-10 opacity-50" />
          </div>
        )}
      </div>
      <div className="grid gap-0.5 p-3">
        <p className="ct-heading truncate text-[15px]">
          {vehicle.year ? `${vehicle.year} ` : ''}
          {vehicle.make} {vehicle.model}
        </p>
        <p className="truncate text-xs text-[var(--ct-muted)]">
          {vehicle.nickname ? `“${vehicle.nickname}” · ` : ''}@{vehicle.owner.username}
        </p>
        {showSpecs && vehicle.currentHp && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--ct-muted)]">
            <Gauge className="size-3.5" aria-hidden="true" /> {vehicle.currentHp} hp <span className="opacity-70">(owner-reported)</span>
          </p>
        )}
      </div>
    </Link>
  );
}

function EventRow({ event, layout, locale }: { event: EventSummary; layout: 'list' | 'cards' | 'ticket'; locale: string }) {
  const date = new Date(event.startsAt);
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: event.timezone }).format(date);
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: event.timezone }).format(date);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: event.timezone }).format(date);
  if (layout === 'ticket') {
    return (
      <Link href={`/events/${event.id}`} className="ct-card relative flex overflow-hidden" data-interactive="true">
        <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-dashed border-[var(--ct-border)] py-3" style={{ color: 'var(--ct-primary-text)' }}>
          <span className="ct-heading text-2xl leading-none">{day}</span>
          <span className="text-[11px] font-semibold tracking-widest uppercase">{month}</span>
        </div>
        <div className="grid min-w-0 flex-1 gap-1 p-3">
          <p className="truncate font-semibold">{event.title}</p>
          <p className="flex items-center gap-1 truncate text-xs text-[var(--ct-muted)]">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {event.city ?? 'Location shared with members'} · {time}
          </p>
          <p className="text-xs text-[var(--ct-muted)]">{event.goingCount} going</p>
        </div>
      </Link>
    );
  }
  if (layout === 'cards') {
    return (
      <Link href={`/events/${event.id}`} className="ct-card block overflow-hidden" data-interactive="true">
        <div className="relative aspect-[16/7] bg-[var(--ct-surface-2)]">
          {event.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(event.coverImage, { width: 800, crop: 'fill' })} alt="" loading="lazy" className="size-full object-cover" />
          )}
          <span className="ct-badge absolute top-2 left-2">
            {day} {month}
          </span>
        </div>
        <div className="grid gap-1 p-3">
          <p className="ct-heading truncate">{event.title}</p>
          <p className="text-xs text-[var(--ct-muted)]">
            {time} · {event.city ?? '—'} · {event.goingCount} going
          </p>
        </div>
      </Link>
    );
  }
  return (
    <Link href={`/events/${event.id}`} className="flex items-center gap-3 rounded-[var(--ct-radius-sm)] p-2 transition hover:bg-[var(--ct-surface-hover)]">
      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-[var(--ct-radius-sm)] bg-[var(--ct-surface-2)] leading-none">
        <span className="text-sm font-bold">{day}</span>
        <span className="text-[10px] tracking-wider text-[var(--ct-muted)] uppercase">{month}</span>
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-semibold">{event.title}</span>
        <span className="truncate text-xs text-[var(--ct-muted)]">
          {time}
          {event.city ? ` · ${event.city}` : ''} · {event.goingCount} going
        </span>
      </span>
    </Link>
  );
}

function PostRow({ post, locale }: { post: WidgetPost; locale: string }) {
  return (
    <div className="grid gap-1.5 border-b border-[var(--ct-border-subtle)] py-3 last:border-0">
      <div className="flex items-center gap-2 text-xs text-[var(--ct-muted)]">
        {post.author && <MiniAvatar user={post.author} size={20} />}
        <span className="font-semibold text-[var(--ct-text)]">{post.author?.displayName ?? 'Crew'}</span>
        {post.channelName && <span>in #{post.channelName}</span>}
        <span>· {formatRelative(post.createdAt, locale)}</span>
      </div>
      <p className="line-clamp-3 text-sm">{post.text}</p>
      {(post.replyCount > 0 || post.reactionCount > 0) && (
        <p className="flex gap-3 text-xs text-[var(--ct-muted)]">
          {post.replyCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" aria-hidden="true" /> {post.replyCount}
            </span>
          )}
          {post.reactionCount > 0 && <span>♥ {post.reactionCount}</span>}
        </p>
      )}
    </div>
  );
}

function Countdown({ event, label, locale }: { event: EventSummary | null; label: string; locale: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!event) return <Empty>No upcoming events yet.</Empty>;
  const diff = Math.max(0, new Date(event.startsAt).getTime() - (now ?? new Date(event.startsAt).getTime()));
  const parts = [
    { v: Math.floor(diff / 86_400_000), l: 'days' },
    { v: Math.floor((diff / 3_600_000) % 24), l: 'hrs' },
    { v: Math.floor((diff / 60_000) % 60), l: 'min' },
    { v: Math.floor((diff / 1000) % 60), l: 'sec' },
  ];
  return (
    <Link href={`/events/${event.id}`} className="grid gap-3">
      <p className="text-xs font-semibold tracking-[0.18em] text-[var(--ct-accent-text)] uppercase">{label}</p>
      <p className="ct-heading truncate text-lg">{event.title}</p>
      <div className="grid grid-cols-4 gap-2" aria-live="off">
        {parts.map((p) => (
          <div key={p.l} className="rounded-[var(--ct-radius-sm)] bg-[var(--ct-surface-2)] py-2 text-center">
            <p className="ct-heading text-2xl tabular-nums" suppressHydrationWarning>
              {now === null ? '–' : String(p.v).padStart(2, '0')}
            </p>
            <p className="text-[10px] tracking-wider text-[var(--ct-muted)] uppercase">{p.l}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--ct-muted)]">{formatDate(event.startsAt, locale, event.timezone)}</p>
    </Link>
  );
}

function Poll({ widget, ctx }: { widget: WidgetOf<'poll'>; ctx: WidgetRenderContext }) {
  const initial = dataFor<'poll'>(ctx, widget);
  const [result, setResult] = useState<PollResult | undefined>(initial);
  const vote = useMutation({
    mutationFn: (index: number) => api.crews.vote(ctx.crewId!, widget.id, index),
    onSuccess: setResult,
  });
  const total = result?.total ?? 0;
  const canVote = ctx.mode === 'live' && ctx.isMember && !result?.closed && result?.viewerChoice === null;
  return (
    <div className="grid gap-3">
      <p className="font-semibold">{widget.props.question}</p>
      <div className="grid gap-2">
        {widget.props.options.map((option, i) => {
          const count = result?.counts[i] ?? 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const chosen = result?.viewerChoice === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!canVote || vote.isPending}
              onClick={() => vote.mutate(i)}
              className={cn(
                'relative overflow-hidden rounded-[var(--ct-radius-sm)] border px-3 py-2 text-left text-sm transition',
                chosen ? 'border-[var(--ct-primary)]' : 'border-[var(--ct-border)]',
                canVote && 'hover:border-[var(--ct-primary)]',
              )}
            >
              <span className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--ct-primary)_18%,transparent)] transition-all" style={{ width: `${pct}%` }} aria-hidden="true" />
              <span className="relative flex justify-between gap-3">
                <span>{option}</span>
                {result && (result.viewerChoice !== null || result.closed || !ctx.isMember) && <span className="tabular-nums text-[var(--ct-muted)]">{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--ct-muted)]">
        {total} {total === 1 ? 'vote' : 'votes'}
        {!ctx.isMember && ctx.mode === 'live' ? ' · Members can vote' : ''}
      </p>
    </div>
  );
}

function Calendar({ events, months, locale }: { events: EventSummary[]; months: number; locale: string }) {
  const start = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);
  const byDay = useMemo(() => {
    const map = new Map<string, EventSummary[]>();
    for (const e of events) {
      const key = new Date(e.startsAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return map;
  }, [events]);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2024, 0, i + 1)));
  return (
    <div className="grid gap-5">
      {Array.from({ length: months }, (_, m) => {
        const month = new Date(start.getFullYear(), start.getMonth() + m, 1);
        const offset = (month.getDay() + 6) % 7;
        const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        return (
          <div key={m} className="grid gap-2">
            <p className="text-sm font-semibold">{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
              {weekdays.map((w, i) => (
                <span key={i} className="text-[var(--ct-muted)]">
                  {w}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`o${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, d) => {
                const date = new Date(month.getFullYear(), month.getMonth(), d + 1);
                const dayEvents = byDay.get(date.toDateString());
                const today = date.toDateString() === new Date().toDateString();
                return (
                  <span
                    key={d}
                    title={dayEvents?.map((e) => e.title).join(', ')}
                    className={cn(
                      'relative flex aspect-square items-center justify-center rounded-[var(--ct-radius-sm)] text-xs',
                      dayEvents ? 'bg-[var(--ct-primary)] font-bold text-[var(--ct-primary-contrast)]' : today ? 'ring-1 ring-[var(--ct-border)]' : '',
                    )}
                  >
                    {d + 1}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stats({ data, items, locale }: { data: WidgetDataByType['stats'] | undefined; items: WidgetOf<'stats'>['props']['items']; locale: string }) {
  const labels = { members: 'Members', channels: 'Channels', builds: 'Builds', events: 'Events', founded: 'Founded' } as const;
  return (
    <div className="grid grid-cols-2 gap-4 md:flex md:flex-wrap md:justify-between">
      {items.map((key) => (
        <div key={key} className="grid gap-1">
          <p className="ct-heading text-3xl tabular-nums" style={{ color: 'var(--ct-primary-text)' }}>
            {key === 'founded'
              ? data?.founded
                ? new Date(data.founded).getFullYear()
                : '—'
              : data
                ? compactNumber(data[key], locale)
                : '—'}
          </p>
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--ct-muted)] uppercase">{labels[key]}</p>
        </div>
      ))}
    </div>
  );
}

/** Renders the body of a widget. Each widget only displays data the API already authorised for the viewer. */
export function WidgetBody({ widget, ctx }: { widget: ThemeWidget; ctx: WidgetRenderContext }) {
  switch (widget.type) {
    case 'welcome': {
      const p = widget.props;
      return (
        <div className={cn('grid gap-5 md:grid-cols-[1fr_auto] md:items-center', p.align === 'center' && 'text-center md:grid-cols-1')}>
          <div className={cn('grid gap-3', p.align === 'center' && 'justify-items-center')}>
            {p.eyebrow && <p className="text-xs font-semibold tracking-[0.2em] text-[var(--ct-accent-text)] uppercase">{p.eyebrow}</p>}
            <h2 className="ct-heading max-w-3xl" style={{ fontSize: 'calc(clamp(1.6rem, 3.6vw, 2.6rem) * var(--ct-type-scale))' }}>
              {p.heading}
            </h2>
            <Markdown text={p.body} className="max-w-2xl text-[var(--ct-muted)]" />
            {p.showJoinButton && !ctx.isMember && ctx.joinAction}
          </div>
          {p.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(p.imageUrl, { width: 640, crop: 'limit' })} alt="" className="ct-card max-h-64 w-full object-cover md:w-80" />
          )}
        </div>
      );
    }
    case 'announcements': {
      const d = dataFor<'announcements'>(ctx, widget);
      if (!d?.items.length) return <Empty>No announcements yet.</Empty>;
      return <div>{d.items.map((post) => <PostRow key={post.id} post={post} locale={ctx.locale} />)}</div>;
    }
    case 'member_count': {
      const d = dataFor<'member_count'>(ctx, widget);
      const p = widget.props;
      return (
        <div className={cn('grid gap-2', p.display === 'compact' && 'flex items-center justify-between')}>
          <p className="text-xs font-semibold tracking-[0.14em] text-[var(--ct-muted)] uppercase">{p.label}</p>
          <p className="ct-heading text-4xl tabular-nums" style={{ color: 'var(--ct-primary-text)' }}>
            {d ? compactNumber(d.members, ctx.locale) : '—'}
          </p>
          {p.showOnline && d?.online !== null && d?.online !== undefined && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--ct-muted)]">
              <span className="size-2 rounded-full bg-[var(--ct-success)]" aria-hidden="true" /> {d.online} online
            </p>
          )}
          {p.display === 'avatars' && d?.avatars.length ? (
            <div className="flex -space-x-2">
              {d.avatars.slice(0, 8).map((u) => (
                <span key={u.id} className="rounded-full ring-2 ring-[var(--ct-surface)]">
                  <MiniAvatar user={u} size={28} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      );
    }
    case 'featured_member': {
      const d = dataFor<'featured_member'>(ctx, widget);
      if (!d?.user) return <Empty>Choose a member to feature.</Empty>;
      return (
        <Link href={`/u/${d.user.username}`} className="flex items-center gap-4">
          <MiniAvatar user={d.user} size={64} />
          <div className="grid min-w-0 gap-1">
            <p className="ct-heading truncate text-lg">{d.user.displayName}</p>
            <p className="text-xs text-[var(--ct-muted)]">@{d.user.username}</p>
            {widget.props.caption && <p className="text-sm">{widget.props.caption}</p>}
          </div>
        </Link>
      );
    }
    case 'featured_car': {
      const d = dataFor<'featured_car'>(ctx, widget);
      if (!d?.vehicle) return <Empty>Choose a car shared with the crew.</Empty>;
      return (
        <div className="grid gap-3">
          <VehicleTile vehicle={d.vehicle} large showSpecs={widget.props.showSpecs} />
          {widget.props.caption && <p className="text-sm text-[var(--ct-muted)]">{widget.props.caption}</p>}
        </div>
      );
    }
    case 'vehicle_gallery': {
      const d = dataFor<'vehicle_gallery'>(ctx, widget);
      if (!d?.vehicles.length) return <Empty>No cars shared with the crew yet.</Empty>;
      const layout = widget.props.layout;
      return (
        <div
          className={cn(
            layout === 'carousel'
              ? 'scrollbar-none flex snap-x gap-3 overflow-x-auto [&>*]:w-64 [&>*]:shrink-0 [&>*]:snap-start'
              : layout === 'mosaic'
                ? 'grid grid-cols-2 gap-3 md:grid-cols-4 [&>*:first-child]:col-span-2 [&>*:first-child]:row-span-2'
                : 'grid grid-cols-2 gap-3 md:grid-cols-4',
          )}
        >
          {d.vehicles.map((v) => (
            <VehicleTile key={v.id} vehicle={v} />
          ))}
        </div>
      );
    }
    case 'build_projects': {
      const d = dataFor<'build_projects'>(ctx, widget);
      if (!d?.items.length) return <Empty>No build updates yet.</Empty>;
      return (
        <div className="grid gap-2">
          {d.items.map((item) => (
            <Link key={item.vehicle.id} href={`/v/${item.vehicle.id}`} className="flex items-center gap-3 rounded-[var(--ct-radius-sm)] p-2 transition hover:bg-[var(--ct-surface-hover)]">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-[var(--ct-radius-sm)] bg-[var(--ct-surface-2)]">
                {item.vehicle.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(item.vehicle.coverImage, { width: 120, height: 120, crop: 'fill' })} alt="" className="size-full object-cover" />
                )}
              </span>
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {item.vehicle.make} {item.vehicle.model}
                </span>
                <span className="truncate text-xs text-[var(--ct-muted)]">{item.latestUpdate?.title ?? `by @${item.owner.username}`}</span>
              </span>
              <ArrowUpRight className="ml-auto size-4 shrink-0 text-[var(--ct-muted)]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      );
    }
    case 'upcoming_meets': {
      const d = dataFor<'upcoming_meets'>(ctx, widget);
      if (!d?.events.length) return <Empty>No upcoming meets.</Empty>;
      return (
        <div className={cn('grid gap-2', widget.props.layout === 'cards' && 'gap-3 md:grid-cols-2')}>
          {d.events.map((e) => (
            <EventRow key={e.id} event={e} layout={widget.props.layout} locale={ctx.locale} />
          ))}
        </div>
      );
    }
    case 'event_calendar': {
      const d = dataFor<'event_calendar'>(ctx, widget);
      return <Calendar events={d?.events ?? []} months={widget.props.months} locale={ctx.locale} />;
    }
    case 'countdown': {
      const d = dataFor<'countdown'>(ctx, widget);
      return <Countdown event={d?.event ?? null} label={widget.props.label} locale={ctx.locale} />;
    }
    case 'rich_text':
      return (
        <Markdown
          text={widget.props.markdown}
          blocks
          className={cn(widget.props.align === 'center' && 'text-center', widget.props.size === 'lg' ? 'text-lg' : widget.props.size === 'sm' ? 'text-sm' : '')}
        />
      );
    case 'image_gallery': {
      const images = widget.props.images;
      if (!images.length) return <Empty>Add photos in Crew Studio.</Empty>;
      return (
        <div
          className={cn(
            widget.props.layout === 'carousel'
              ? 'scrollbar-none flex snap-x gap-3 overflow-x-auto'
              : widget.props.layout === 'mosaic'
                ? 'grid grid-cols-2 gap-2 md:grid-cols-3 [&>*:nth-child(3n+1)]:row-span-2'
                : 'grid grid-cols-2 gap-2 md:grid-cols-4',
          )}
        >
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={mediaUrl(img.url, { width: 800, crop: 'limit' })}
              alt={img.alt}
              loading="lazy"
              className={cn('h-full w-full rounded-[var(--ct-radius-sm)] object-cover', widget.props.layout === 'carousel' && 'h-56 w-auto shrink-0 snap-start')}
            />
          ))}
        </div>
      );
    }
    case 'links': {
      const links = widget.props.links;
      if (!links.length) return <Empty>No links yet.</Empty>;
      return (
        <div className={cn('grid gap-2', widget.props.layout === 'tiles' && 'grid-cols-2', widget.props.layout === 'buttons' && 'flex flex-wrap')}>
          {links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={cn(
                'inline-flex items-center gap-2 text-sm transition',
                widget.props.layout === 'buttons'
                  ? 'ct-button'
                  : widget.props.layout === 'tiles'
                    ? 'ct-card flex-col items-start p-3'
                    : 'justify-between rounded-[var(--ct-radius-sm)] px-2 py-2 hover:bg-[var(--ct-surface-hover)]',
              )}
            >
              <span className="inline-flex items-center gap-2">
                <ThemeIcon name={link.icon ?? 'link'} className="size-4" />
                {link.label}
              </span>
              {widget.props.layout === 'list' && <ArrowUpRight className="size-4 text-[var(--ct-muted)]" aria-hidden="true" />}
            </a>
          ))}
        </div>
      );
    }
    case 'poll':
      return <Poll widget={widget} ctx={ctx} />;
    case 'rules': {
      const items = widget.props.source === 'crew' ? ctx.crewRules : widget.props.items;
      if (!items.length) return <Empty>No rules set.</Empty>;
      const Tag = widget.props.numbered ? 'ol' : 'ul';
      return (
        <Tag className="grid gap-2.5">
          {items.map((rule, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="ct-heading w-6 shrink-0 text-[var(--ct-primary-text)]">{widget.props.numbered ? String(i + 1).padStart(2, '0') : '—'}</span>
              <span>{rule}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'leaderboard': {
      const d = dataFor<'leaderboard'>(ctx, widget);
      if (!d?.entries.length) return <Empty>Not enough activity yet.</Empty>;
      return (
        <ol className="grid gap-1">
          {d.entries.map((entry, i) => (
            <li key={entry.user.id} className="flex items-center gap-3 rounded-[var(--ct-radius-sm)] px-2 py-1.5">
              <span className={cn('w-5 text-center text-sm font-bold tabular-nums', i === 0 ? 'text-[var(--ct-primary-text)]' : 'text-[var(--ct-muted)]')}>
                {i === 0 ? <Trophy className="mx-auto size-4" aria-label="1" /> : i + 1}
              </span>
              <MiniAvatar user={entry.user} size={26} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.user.displayName}</span>
              <span className="text-xs text-[var(--ct-muted)] tabular-nums">{compactNumber(entry.value, ctx.locale)}</span>
            </li>
          ))}
        </ol>
      );
    }
    case 'popular_discussions': {
      const d = dataFor<'popular_discussions'>(ctx, widget);
      if (!d?.items.length) return <Empty>Quiet week so far.</Empty>;
      return <div>{d.items.map((post) => <PostRow key={post.id} post={post} locale={ctx.locale} />)}</div>;
    }
    case 'channel_list': {
      const d = dataFor<'channel_list'>(ctx, widget);
      if (!d?.channels.length) return <Empty>{ctx.isMember ? 'No channels yet.' : 'Join to see channels.'}</Empty>;
      return (
        <div className={cn('grid gap-1', widget.props.layout === 'tiles' && 'grid-cols-2 gap-2')}>
          {d.channels.map((ch) => (
            <Link
              key={ch.id}
              href={`/c/${ctx.crewSlug}/ch/${ch.id}`}
              className={cn(
                'flex items-start gap-2 rounded-[var(--ct-radius-sm)] p-2 text-sm transition hover:bg-[var(--ct-surface-hover)]',
                widget.props.layout === 'tiles' && 'ct-card flex-col',
              )}
            >
              <ThemeIcon name={ch.icon ?? (ch.type === 'announcement' ? 'megaphone' : ch.type === 'voice' ? 'mic' : 'hash')} className="mt-0.5 size-4 shrink-0 text-[var(--ct-muted)]" />
              <span className="grid min-w-0">
                <span className="truncate font-medium">{ch.name}</span>
                {widget.props.showTopics && ch.topic && <span className="truncate text-xs text-[var(--ct-muted)]">{ch.topic}</span>}
              </span>
            </Link>
          ))}
        </div>
      );
    }
    case 'video': {
      const embed = widget.props.url ? toVideoEmbedUrl(widget.props.url) : null;
      if (!embed) return <Empty>Add a YouTube or Vimeo link.</Empty>;
      return (
        <figure className="grid gap-2">
          <div className="ct-card aspect-video overflow-hidden">
            <iframe
              src={embed}
              title={widget.props.caption ?? 'Video'}
              loading="lazy"
              className="size-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            />
          </div>
          {widget.props.caption && <figcaption className="text-xs text-[var(--ct-muted)]">{widget.props.caption}</figcaption>}
        </figure>
      );
    }
    case 'stats':
      return <Stats data={dataFor<'stats'>(ctx, widget)} items={widget.props.items} locale={ctx.locale} />;
    case 'spacer':
      return (
        <div className={cn('flex items-center', widget.props.size === 'sm' ? 'h-4' : widget.props.size === 'lg' ? 'h-16' : 'h-8')}>
          {widget.props.divider && <div className="ct-divider w-full" />}
        </div>
      );
    default:
      return null;
  }
}

