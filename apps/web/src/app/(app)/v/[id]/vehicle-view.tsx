'use client';

import { isApiError } from '@vogn/api-client';
import type { VehicleDetail } from '@vogn/types';
import { formatPower, formatRelative, formatTorque } from '@vogn/utils';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, Flag, Heart, Info, MessageCircle, Pencil, Share2, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { PageContainer } from '@/components/app/page';
import { ReportDialog } from '@/components/app/report-dialog';
import { Markdown } from '@/components/content/markdown';
import { BuildTimeline } from '@/components/garage/build-timeline';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Skeleton } from '@/components/ui/display';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useProfile } from '@/lib/hooks';
import { ASPIRATION_LABELS, DRIVETRAIN_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from '@/lib/labels';
import { mediaUrl } from '@/lib/media';

function SpecRow({ label, value, source }: { label: string; value: ReactNode; source: 'owner' | 'official' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex items-baseline gap-2 text-right text-sm font-medium">
        {value}
        <span className={cn('text-[10px] font-semibold tracking-wide uppercase', source === 'official' ? 'text-info' : 'text-subtle')}>
          {source === 'official' ? 'Official' : 'Owner'}
        </span>
      </dd>
    </div>
  );
}

function Comments({ vehicle }: { vehicle: VehicleDetail }) {
  const locale = useLocale();
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [body, setBody] = useState('');
  const comments = useInfiniteQuery({
    queryKey: queryKeys.vehicleComments(vehicle.id),
    queryFn: ({ pageParam }) => api.vehicles.comments(vehicle.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const add = useMutation({
    mutationFn: () => api.vehicles.comment(vehicle.id, body),
    onSuccess: () => {
      setBody('');
      void qc.invalidateQueries({ queryKey: queryKeys.vehicleComments(vehicle.id) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.vehicles.deleteComment(vehicle.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vehicleComments(vehicle.id) }),
  });
  const items = comments.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section id="comments" className="grid gap-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <MessageCircle className="size-4" aria-hidden="true" /> Comments
      </h2>
      {vehicle.viewer.canComment && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) add.mutate();
          }}
        >
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={1000} placeholder="Say something nice about this build" aria-label="Comment" />
          <Button type="submit" size="sm" className="w-fit justify-self-end" loading={add.isPending} disabled={!body.trim()}>
            Comment
          </Button>
        </form>
      )}
      {items.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
      <ul className="grid gap-4">
        {items.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Avatar name={c.author.displayName} image={c.author.avatar} accent={c.author.accentColor} size="sm" />
            <div className="grid flex-1 gap-0.5">
              <p className="text-xs">
                <Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">
                  {c.author.displayName}
                </Link>{' '}
                <span className="text-subtle">{formatRelative(c.createdAt, locale)}</span>
              </p>
              <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            </div>
            {c.canDelete && (
              <Button variant="ghost" size="icon-xs" aria-label="Delete comment" onClick={() => remove.mutate(c.id)}>
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {comments.hasNextPage && (
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => void comments.fetchNextPage()}>
          Load more
        </Button>
      )}
    </section>
  );
}

export function VehicleView({ id }: { id: string }) {
  const t = useTranslations('garage');
  const locale = useLocale();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useProfile();
  const units = me?.settings.units ?? 'metric';
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const { data: v, isLoading, error, refetch } = useQuery({ queryKey: queryKeys.vehicle(id), queryFn: () => api.vehicles.get(id) });
  const like = useMutation({
    mutationFn: () => (v!.viewer.liked ? api.vehicles.unlike(id) : api.vehicles.like(id)),
    onSuccess: (r) => qc.setQueryData(queryKeys.vehicle(id), { ...v!, likeCount: r.likeCount, viewer: { ...v!.viewer, liked: r.liked } }),
  });
  const remove = useMutation({
    mutationFn: () => api.vehicles.delete(id),
    onSuccess: () => {
      toast.success('Vehicle deleted');
      router.push('/garage');
    },
  });

  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
      </PageContainer>
    );
  }
  if (error || !v) {
    return (
      <PageContainer>
        {isApiError(error) && error.code === 'NOT_FOUND' ? <EmptyState icon={Car} title="This vehicle doesn’t exist or isn’t shared with you." /> : <ErrorState error={error} onRetry={() => void refetch()} />}
      </PageContainer>
    );
  }

  const share = async () => {
    const url = `${window.location.origin}/v/${v.id}`;
    if (navigator.share) await navigator.share({ title: `${v.make} ${v.model} on VOGN`, url }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  };
  const byCategory = v.categories
    .map((c) => ({ category: c, items: v.modifications.filter((m) => m.categoryId === c.id) }))
    .filter((g) => g.items.length);
  const summaryText: [string, string | null][] = [
    [t('suspension'), v.suspension],
    [t('exhaust'), v.exhaust],
    [t('ecuTuning'), v.ecuTuning],
    [t('turbo'), v.turbo],
    [t('interior'), v.interior],
    [t('audio'), v.audio],
  ];
  const media = v.gallery;

  return (
    <PageContainer width="wide" className="pt-4">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="relative aspect-[16/9] max-h-[520px] w-full overflow-hidden bg-elevated md:aspect-[21/9]">
          {v.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(v.coverImage, { width: 2000, crop: 'fill' })} alt={`${v.make} ${v.model}`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center bg-[radial-gradient(80%_80%_at_30%_20%,var(--vogn-accent-muted),var(--vogn-surface))]">
              <Car className="size-16 text-subtle" aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 grid gap-2 p-5 text-white md:p-8">
            <div className="flex flex-wrap gap-1.5">
              {v.verification.specsConfirmed && (
                <Badge tone="info" className="bg-black/40 text-white backdrop-blur">
                  <ShieldCheck aria-hidden="true" /> Specs confirmed
                </Badge>
              )}
              {v.verification.accessReviewed && <Badge className="bg-black/40 text-white backdrop-blur">Access reviewed</Badge>}
              {v.verification.ownershipEvidenceReviewed && <Badge className="bg-black/40 text-white backdrop-blur">Ownership evidence reviewed</Badge>}
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              {v.year ? `${v.year} ` : ''}
              {v.make} {v.model}
            </h1>
            <p className="text-white/75">
              {[v.generation, v.trim, v.nickname && `“${v.nickname}”`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4 md:px-8">
          <Link href={`/u/${v.owner.username}`} className="flex items-center gap-2">
            <Avatar name={v.owner.displayName} image={v.owner.avatar} accent={v.owner.accentColor} size="sm" />
            <span className="text-sm font-medium">{v.owner.displayName}</span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {v.likesEnabled && (
              <Button variant={v.viewer.liked ? 'primary' : 'secondary'} size="sm" onClick={() => (me ? like.mutate() : router.push('/sign-in'))}>
                <Heart className={cn(v.viewer.liked && 'fill-current')} aria-hidden="true" /> {v.likeCount}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => void share()}>
              <Share2 aria-hidden="true" /> Share
            </Button>
            {v.viewer.isOwner ? (
              <>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/verification?vehicle=${v.id}`}>
                    <ShieldCheck aria-hidden="true" /> Verify
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/garage/${v.id}/edit`}>
                    <Pencil aria-hidden="true" /> Edit
                  </Link>
                </Button>
                <Button
                  variant="danger-ghost"
                  size="icon-sm"
                  aria-label="Delete vehicle"
                  onClick={() => {
                    if (window.confirm(t('deleteConfirm'))) remove.mutate();
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </>
            ) : (
              me && (
                <Button variant="ghost" size="icon-sm" aria-label="Report" onClick={() => setReportOpen(true)}>
                  <Flag aria-hidden="true" />
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-10">
          {v.description && <Markdown text={v.description} blocks className="max-w-3xl text-[15px] leading-relaxed" />}
          {media.length > 1 && (
            <section className="grid gap-3">
              <h2 className="text-[15px] font-semibold">{t('gallery')}</h2>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {media.map((m, i) => (
                  <button key={m.id} type="button" onClick={() => setLightbox(i)} className={cn('overflow-hidden rounded-lg', i === 0 && 'col-span-2 row-span-2')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(m.thumbnailUrl ?? m, { width: i === 0 ? 900 : 450, height: i === 0 ? 900 : 450, crop: 'fill' })} alt="" loading="lazy" className="aspect-square size-full object-cover transition hover:opacity-90" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {byCategory.length > 0 && (
            <section className="grid gap-4">
              <h2 className="text-[15px] font-semibold">{t('modifications')}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {byCategory.map(({ category, items }) => (
                  <div key={category.id} className="rounded-xl border border-line bg-surface p-4">
                    <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-accent-text uppercase">{category.name}</p>
                    <ul className="grid gap-3">
                      {items.map((m) => (
                        <li key={m.id} className="grid gap-1">
                          <p className="text-sm font-medium">
                            {m.brand && <span className="text-muted">{m.brand} </span>}
                            {m.name}
                          </p>
                          {m.fields.length > 0 && (
                            <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                              {m.fields.map((f) => (
                                <span key={f.key}>
                                  {f.key}: <span className="text-fg">{f.value}</span>
                                </span>
                              ))}
                            </p>
                          )}
                          {m.notes && <p className="text-xs text-muted">{m.notes}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
          <BuildTimeline vehicle={v} />
          {v.commentsEnabled && <Comments vehicle={v} />}
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-1 text-[15px] font-semibold">{t('specs')}</h2>
            <p className="mb-3 flex gap-1.5 text-xs text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {t('ownerClaimNote')}
            </p>
            <dl>
              {v.specs.engine && <SpecRow label={t('engine')} value={v.specs.engine} source="owner" />}
              {v.specs.displacementCc && <SpecRow label={t('displacement')} value={`${v.specs.displacementCc} cc`} source="owner" />}
              {v.specs.aspiration && <SpecRow label={t('aspiration')} value={ASPIRATION_LABELS[v.specs.aspiration]} source="owner" />}
              {v.specs.fuel && <SpecRow label={t('fuel')} value={FUEL_LABELS[v.specs.fuel]} source="owner" />}
              {v.specs.originalHp && <SpecRow label={t('originalHp')} value={formatPower(v.specs.originalHp, units, locale)} source="owner" />}
              {v.specs.currentHp && <SpecRow label={t('currentHp')} value={formatPower(v.specs.currentHp, units, locale)} source="owner" />}
              {v.specs.torqueNm && <SpecRow label="Torque" value={formatTorque(v.specs.torqueNm, units, locale)} source="owner" />}
              {v.drivetrain && <SpecRow label={t('drivetrain')} value={DRIVETRAIN_LABELS[v.drivetrain]} source="owner" />}
              {v.transmission && <SpecRow label={t('transmission')} value={TRANSMISSION_LABELS[v.transmission]} source="owner" />}
              {v.color && <SpecRow label={t('color')} value={v.color} source="owner" />}
              {(v.wheels.front || v.wheels.tires) && <SpecRow label={t('wheels')} value={[v.wheels.front, v.wheels.rear, v.wheels.tires].filter(Boolean).join(' / ')} source="owner" />}
            </dl>
            {v.totalExpenses && (
              <p className="mt-3 text-sm text-muted">
                Logged expenses:{' '}
                <strong className="text-fg">
                  {new Intl.NumberFormat(locale, { style: 'currency', currency: v.totalExpenses.currency, maximumFractionDigits: 0 }).format(v.totalExpenses.amount)}
                </strong>
              </p>
            )}
          </section>
          {v.officialData && (
            <section className="rounded-xl border border-[color-mix(in_srgb,var(--vogn-info)_35%,transparent)] bg-surface p-5">
              <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
                <ShieldCheck className="size-4 text-info" aria-hidden="true" /> {t('officialData')}
              </h2>
              <p className="mb-3 text-xs text-muted">{t('officialNote', { provider: v.officialData.provider })}</p>
              <dl>
                {v.officialData.make && <SpecRow label={t('make')} value={v.officialData.make} source="official" />}
                {v.officialData.model && <SpecRow label={t('model')} value={v.officialData.model} source="official" />}
                {v.officialData.powerKw && <SpecRow label="Power" value={`${v.officialData.powerKw} kW`} source="official" />}
                {v.officialData.displacementCc && <SpecRow label={t('displacement')} value={`${v.officialData.displacementCc} cc`} source="official" />}
                {v.officialData.fuel && <SpecRow label={t('fuel')} value={v.officialData.fuel} source="official" />}
                {v.officialData.gearbox && <SpecRow label={t('transmission')} value={v.officialData.gearbox} source="official" />}
                {v.officialData.firstRegistration && <SpecRow label="First registered" value={v.officialData.firstRegistration} source="official" />}
              </dl>
            </section>
          )}
          {summaryText.some(([, val]) => val) && (
            <section className="grid gap-3 rounded-xl border border-line bg-surface p-5">
              {summaryText
                .filter(([, val]) => val)
                .map(([label, val]) => (
                  <div key={label} className="grid gap-0.5">
                    <p className="text-xs font-semibold tracking-[0.12em] text-subtle uppercase">{label}</p>
                    <p className="text-sm whitespace-pre-wrap">{val}</p>
                  </div>
                ))}
            </section>
          )}
        </aside>
      </div>

      <Dialog open={lightbox !== null} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent size="xl" className="bg-black p-2">
          {lightbox !== null && media[lightbox] && (
            media[lightbox]!.kind === 'video' ? (
              <video src={media[lightbox]!.url} controls autoPlay className="max-h-[80dvh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(media[lightbox]!, { width: 2000, crop: 'limit' })} alt="" className="max-h-[80dvh] w-full object-contain" />
            )
          )}
        </DialogContent>
      </Dialog>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="vehicle" targetId={v.id} label="this vehicle" />
    </PageContainer>
  );
}
