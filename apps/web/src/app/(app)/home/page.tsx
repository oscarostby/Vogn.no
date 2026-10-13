'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Car, Check, Compass, MessagesSquare, Plus, User, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { BuildCard, EventRowCard, VehicleCard } from '@/components/app/cards';
import { PageContainer, SectionTitle } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/display';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useProfile } from '@/lib/hooks';
import { formatRelative } from '@vogn/utils';

export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();
  const me = useProfile();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: queryKeys.home, queryFn: () => api.me.home() });

  return (
    <PageContainer width="wide">
      <header className="mb-8 grid gap-1">
        <p className="text-xs font-semibold tracking-[0.16em] text-accent-text uppercase">VOGN</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{t('greeting', { name: me?.displayName ?? '' })}</h1>
      </header>

      {isLoading && <ListSkeleton rows={6} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-start gap-10">
            {(!data.onboarding.hasAvatar || !data.onboarding.hasVehicle || !data.onboarding.hasCrew) && (
              <section className="rounded-xl border border-line bg-surface p-5">
                <SectionTitle title={t('getStarted')} />
                <ol className="grid gap-2 sm:grid-cols-3">
                  {[
                    { done: data.onboarding.hasAvatar, label: t('stepProfile'), href: '/settings/profile', icon: User },
                    { done: data.onboarding.hasVehicle, label: t('stepGarage'), href: '/garage/new', icon: Car },
                    { done: data.onboarding.hasCrew, label: t('stepCrew'), href: '/discover', icon: Users },
                  ].map((step) => (
                    <li key={step.label}>
                      <Link
                        href={step.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3 text-sm transition',
                          step.done ? 'border-transparent bg-elevated text-muted' : 'border-line hover:border-accent-text',
                        )}
                      >
                        <span className={cn('flex size-8 items-center justify-center rounded-full', step.done ? 'bg-accent text-accent-fg' : 'bg-elevated text-muted')}>
                          {step.done ? <Check className="size-4" aria-hidden="true" /> : <step.icon className="size-4" aria-hidden="true" />}
                        </span>
                        <span className={cn(step.done && 'line-through')}>{step.label}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section>
              <SectionTitle
                title={t('yourCrews')}
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/crews">
                      All <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                }
              />
              {data.crews.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.crews.slice(0, 6).map((crew) => (
                    <Link key={crew.id} href={`/c/${crew.slug}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition hover:border-line-strong">
                      <Avatar name={crew.name} image={crew.icon} shape="rounded" size="lg" accent={crew.accentColor} />
                      <span className="grid min-w-0 flex-1">
                        <span className="truncate font-semibold">{crew.name}</span>
                        <span className="text-xs text-muted">{crew.memberCount} members</span>
                      </span>
                      {crew.mentionCount > 0 ? (
                        <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-danger-fg">{crew.mentionCount}</span>
                      ) : crew.unreadCount > 0 ? (
                        <span className="size-2.5 rounded-full bg-fg" aria-label="Unread" />
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Compass}
                  title={t('noCrews')}
                  action={
                    <div className="flex gap-2">
                      <Button asChild size="sm">
                        <Link href="/discover">{t('findCrews')}</Link>
                      </Button>
                      <Button asChild size="sm" variant="secondary">
                        <Link href="/crews/new">
                          <Plus aria-hidden="true" /> Create
                        </Link>
                      </Button>
                    </div>
                  }
                />
              )}
            </section>

            <section>
              <SectionTitle
                title={t('fromCommunity')}
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/discover?tab=builds">
                      More <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                }
              />
              {data.builds.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {data.builds.map((b) => (
                    <BuildCard key={b.vehicle.id} item={b} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No public builds yet — be the first to share yours.</p>
              )}
            </section>
          </div>

          <aside className="grid content-start gap-8">
            <section>
              <SectionTitle title={t('upcoming')} action={<Link href="/events" className="text-xs text-muted hover:text-fg">All</Link>} />
              {data.upcomingEvents.length ? (
                <div className="grid gap-2">
                  {data.upcomingEvents.map((e) => (
                    <EventRowCard key={e.id} event={e} locale={locale} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">{t('noEvents')}</p>
              )}
            </section>

            <section>
              <SectionTitle title={t('recentMessages')} action={<Link href="/messages" className="text-xs text-muted hover:text-fg">All</Link>} />
              {data.conversations.length ? (
                <div className="grid gap-1">
                  {data.conversations.map((c) => (
                    <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-elevated">
                      <Avatar name={c.title} image={c.members[0]?.avatar ?? null} accent={c.members[0]?.accentColor} size="md" />
                      <span className="grid min-w-0 flex-1">
                        <span className={cn('truncate text-sm', c.unreadCount ? 'font-semibold' : 'font-medium')}>{c.title}</span>
                        <span className="truncate text-xs text-muted">{c.lastMessage?.text ?? 'No messages yet'}</span>
                      </span>
                      {c.lastMessageAt && <span className="shrink-0 text-[11px] text-subtle">{formatRelative(c.lastMessageAt, locale)}</span>}
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon={MessagesSquare} title="No conversations yet" className="py-8" />
              )}
            </section>

            <section>
              <SectionTitle
                title={t('garage')}
                action={
                  <Button asChild variant="ghost" size="xs">
                    <Link href="/garage/new">
                      <Plus aria-hidden="true" /> {t('addCar')}
                    </Link>
                  </Button>
                }
              />
              {data.garage.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {data.garage.slice(0, 4).map((v) => (
                    <VehicleCard key={v.id} vehicle={v} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Car} title="Your garage is empty" action={<Button asChild size="sm"><Link href="/garage/new">{t('addCar')}</Link></Button>} className="py-8" />
              )}
            </section>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}
