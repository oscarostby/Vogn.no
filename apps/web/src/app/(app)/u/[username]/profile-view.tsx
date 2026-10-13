'use client';

import { isApiError } from '@vogn/api-client';
import type { PublicProfile } from '@vogn/types';
import { countryFlag, countryName, formatDate } from '@vogn/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Car, Flag, Globe, Lock, MessageSquare, MoreHorizontal, Pencil, UserCheck, UserPlus, UserX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { VehicleCard } from '@/components/app/cards';
import { PageContainer, SectionTitle } from '@/components/app/page';
import { ReportDialog } from '@/components/app/report-dialog';
import { Markdown } from '@/components/content/markdown';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Skeleton, VerificationBadges } from '@/components/ui/display';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { EmptyState, ErrorState, useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { INTEREST_LABELS } from '@/lib/labels';
import { mediaUrl } from '@/lib/media';

function ConnectionButton({ profile }: { profile: PublicProfile }) {
  const t = useTranslations('profile');
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const mutation = useMutation({
    mutationFn: (action: Parameters<typeof api.users.connection>[1]) => api.users.connection(profile.id, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile(profile.username) }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const s = profile.relationship.friendStatus;
  if (s === 'friends')
    return (
      <Button variant="secondary" onClick={() => mutation.mutate('remove')} loading={mutation.isPending}>
        <UserCheck aria-hidden="true" /> {t('friends')}
      </Button>
    );
  if (s === 'pending_outgoing')
    return (
      <Button variant="secondary" onClick={() => mutation.mutate('cancel')} loading={mutation.isPending}>
        {t('requestSent')}
      </Button>
    );
  if (s === 'pending_incoming')
    return (
      <Button onClick={() => mutation.mutate('accept')} loading={mutation.isPending}>
        <UserCheck aria-hidden="true" /> {t('acceptRequest')}
      </Button>
    );
  if (!profile.canSendFriendRequest) return null;
  return (
    <Button variant="secondary" onClick={() => mutation.mutate('request')} loading={mutation.isPending}>
      <UserPlus aria-hidden="true" /> {t('addFriend')}
    </Button>
  );
}

export function ProfileView({ username }: { username: string }) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [reportOpen, setReportOpen] = useState(false);
  const profile = useQuery({ queryKey: queryKeys.profile(username), queryFn: () => api.users.profile(username) });
  const garage = useQuery({
    queryKey: queryKeys.garage(username),
    queryFn: () => api.users.garage(username),
    enabled: profile.data?.access === 'full',
  });

  // Renamed profiles: canonicalise the URL.
  useEffect(() => {
    if (profile.data && profile.data.username.toLowerCase() !== username.toLowerCase()) router.replace(`/u/${profile.data.username}`);
  }, [profile.data, username, router]);

  const message = useMutation({
    mutationFn: () => api.conversations.createDm({ userIds: [profile.data!.id] }),
    onSuccess: (conv) => router.push(`/messages/${conv.id}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const block = useMutation({
    mutationFn: async (): Promise<{ blocked: boolean }> => (profile.data!.relationship.blocked ? api.users.unblock(profile.data!.id) : api.users.block(profile.data!.id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profile(username) });
      toast.success(profile.data!.relationship.blocked ? 'Unblocked' : 'Blocked. They can no longer message you or see your profile.');
    },
  });

  if (profile.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="-mt-10 ml-6 size-24 rounded-full" />
      </PageContainer>
    );
  }
  if (profile.error) {
    return (
      <PageContainer>
        {isApiError(profile.error) && profile.error.code === 'NOT_FOUND' ? (
          <EmptyState icon={UserX} title={t('notFound')} />
        ) : (
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
        )}
      </PageContainer>
    );
  }
  const p = profile.data!;
  const self = p.relationship.isSelf;
  const accent = p.accentColor ?? 'var(--vogn-accent)';

  return (
    <PageContainer className="pt-4 md:pt-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="relative h-40 md:h-56" style={{ background: p.banner ? undefined : `linear-gradient(120deg, color-mix(in srgb, ${accent} 40%, transparent), var(--vogn-surface) 70%)` }}>
          {p.banner && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(p.banner, { width: 1600, height: 450, crop: 'fill' })} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5 md:px-8">
          <Avatar name={p.displayName} image={p.avatar} accent={p.accentColor} size="2xl" className="-mt-14 rounded-full ring-4 ring-surface" />
          <div className="grid min-w-0 flex-1 gap-1 pt-3">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-semibold tracking-tight">
              {p.displayName}
              <VerificationBadges badges={p.badges} compact />
            </h1>
            <p className="text-sm text-muted">
              @{p.username}
              {p.pronouns && <span> · {p.pronouns}</span>}
              {p.country && (
                <span>
                  {' '}
                  · {countryFlag(p.country)} {countryName(p.country, locale)}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {self ? (
              <Button asChild variant="secondary">
                <Link href="/settings/profile">
                  <Pencil aria-hidden="true" /> {t('editProfile')}
                </Link>
              </Button>
            ) : (
              <>
                {p.canMessage && (
                  <Button onClick={() => message.mutate()} loading={message.isPending}>
                    <MessageSquare aria-hidden="true" /> {t('message')}
                  </Button>
                )}
                <ConnectionButton profile={p} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More">
                      <MoreHorizontal aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem icon={<Ban />} onSelect={() => block.mutate()}>
                      {p.relationship.blocked ? 'Unblock' : 'Block'}
                    </DropdownMenuItem>
                    <DropdownMenuItem icon={<Flag />} destructive onSelect={() => setReportOpen(true)}>
                      Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {p.access === 'limited' ? (
        <EmptyState icon={Lock} title={t('limited')} description="This person limits who can see their profile." className="mt-6" />
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid content-start gap-8">
            {p.featuredVehicle && (
              <section>
                <SectionTitle title={t('featuredCar')} />
                <VehicleCard vehicle={p.featuredVehicle} className="max-w-xl" />
              </section>
            )}
            <section>
              <SectionTitle title={`${t('garage')} · ${p.stats.vehicles}`} />
              {garage.data?.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {garage.data.map((v) => (
                    <VehicleCard key={v.id} vehicle={v} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Car} title={self ? 'Add your first car' : 'No public vehicles'} action={self ? <Button asChild size="sm"><Link href="/garage/new">Add vehicle</Link></Button> : undefined} />
              )}
            </section>
          </div>
          <aside className="grid content-start gap-4">
            <div className="grid gap-4 rounded-xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold tracking-[0.14em] text-subtle uppercase">{t('about')}</p>
              {p.bio ? <Markdown text={p.bio} className="text-sm" /> : <p className="text-sm text-muted">—</p>}
              <div className="flex gap-6 text-sm">
                <span>
                  <strong>{p.stats.crews}</strong> <span className="text-muted">crews</span>
                </span>
                <span>
                  <strong>{p.stats.friends}</strong> <span className="text-muted">friends</span>
                </span>
              </div>
              <p className="text-xs text-subtle">{t('joined', { date: formatDate(p.joinedAt, locale) })}</p>
              {p.badges.length > 0 && <VerificationBadges badges={p.badges} />}
            </div>
            {(p.website || p.socialLinks.length > 0) && (
              <div className="grid gap-2 rounded-xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold tracking-[0.14em] text-subtle uppercase">{t('links')}</p>
                {[...(p.website ? [{ platform: 'website', url: p.website }] : []), ...p.socialLinks].map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow me" className="flex items-center gap-2 truncate text-sm text-accent-text hover:underline">
                    <Globe className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{l.url.replace(/^https:\/\/(www\.)?/, '')}</span>
                  </a>
                ))}
              </div>
            )}
            {(p.favoriteBrands.length > 0 || p.interests.length > 0) && (
              <div className="grid gap-3 rounded-xl border border-line bg-surface p-5">
                {p.favoriteBrands.length > 0 && (
                  <div className="grid gap-2">
                    <p className="text-xs font-semibold tracking-[0.14em] text-subtle uppercase">{t('favoriteBrands')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.favoriteBrands.map((b) => (
                        <Badge key={b} className="capitalize">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {p.interests.length > 0 && (
                  <div className="grid gap-2">
                    <p className="text-xs font-semibold tracking-[0.14em] text-subtle uppercase">{t('interests')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.interests.map((i) => (
                        <Badge key={i} tone="accent">
                          {INTEREST_LABELS[i as keyof typeof INTEREST_LABELS] ?? i}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {p.sharedCrews.length > 0 && (
              <div className="grid gap-2 rounded-xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold tracking-[0.14em] text-subtle uppercase">{t('sharedCrews')}</p>
                {p.sharedCrews.map((c) => (
                  <Link key={c.id} href={`/c/${c.slug}`} className="flex items-center gap-2 rounded-md p-1 text-sm hover:bg-elevated">
                    <Avatar name={c.name} image={c.icon} shape="rounded" size="sm" accent={c.accentColor} />
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="user" targetId={p.id} label={`@${p.username}`} />
    </PageContainer>
  );
}
