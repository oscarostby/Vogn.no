'use client';

import type { BuildUpdate, BuildUpdateKind, MediaRef, VehicleDetail } from '@vogn/types';
import { BUILD_UPDATE_KINDS } from '@vogn/types';
import { formatDate } from '@vogn/utils';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Markdown } from '@/components/content/markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/display';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { BUILD_KIND_LABELS } from '@/lib/labels';
import { mediaUrl } from '@/lib/media';
import { MediaUploader } from '../app/media-uploader';

function BeforeAfter({ before, after }: { before: MediaRef; after: MediaRef }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-line select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(after, { width: 1200, crop: 'fill' })} alt="After" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(before, { width: 1200, crop: 'fill' })} alt="Before" className="size-full object-cover" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
      <span className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">Before</span>
      <span className="absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase">After</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Before/after comparison"
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

function AddUpdateDialog({ vehicleId, open, onOpenChange }: { vehicleId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [kind, setKind] = useState<BuildUpdateKind>('update');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [before, setBefore] = useState<MediaRef | null>(null);
  const [after, setAfter] = useState<MediaRef | null>(null);
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('NOK');
  const create = useMutation({
    mutationFn: () =>
      api.vehicles.createUpdate(vehicleId, {
        kind,
        title,
        body: body || null,
        occurredAt: new Date(`${date}T12:00:00Z`).toISOString(),
        mediaIds: media.map((m) => m.id),
        beforeMediaId: before?.id ?? null,
        afterMediaId: after?.id ?? null,
        cost: cost ? { amount: Number(cost), currency } : null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.vehicleUpdates(vehicleId) });
      void qc.invalidateQueries({ queryKey: queryKeys.vehicle(vehicleId) });
      toast.success('Build update posted');
      onOpenChange(false);
      setTitle('');
      setBody('');
      setMedia([]);
      setBefore(null);
      setAfter(null);
      setCost('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="New build update" description="Document progress, parts, dyno runs and milestones." />
        <div className="grid gap-4 sm:grid-cols-[160px_1fr_160px]">
          <Field label="Type">
            {(p) => (
              <NativeSelect {...p} value={kind} onChange={(e) => setKind(e.target.value as BuildUpdateKind)}>
                {BUILD_UPDATE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {BUILD_KIND_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Title">{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}</Field>
          <Field label="Date">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
        <Field label="Details" optional help="Markdown supported.">
          {(p) => <Textarea {...p} rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />}
        </Field>
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">Photos & videos</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {media.map((m) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={mediaUrl(m.thumbnailUrl ?? m, { width: 160, height: 160, crop: 'fill' })} alt="" className="aspect-square rounded-md object-cover" />
            ))}
            {media.length < 10 && <MediaUploader purpose="build_update" accept="media" multiple className="aspect-square" label="Add" onUploaded={(m) => setMedia((l) => [...l, m])} />}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <p className="text-[13px] font-medium">Before</p>
            {before ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(before, { width: 400, height: 250, crop: 'fill' })} alt="" className="aspect-[16/10] rounded-md object-cover" />
            ) : (
              <MediaUploader purpose="build_update" className="aspect-[16/10]" label="Before photo" onUploaded={setBefore} />
            )}
          </div>
          <div className="grid gap-2">
            <p className="text-[13px] font-medium">After</p>
            {after ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(after, { width: 400, height: 250, crop: 'fill' })} alt="" className="aspect-[16/10] rounded-md object-cover" />
            ) : (
              <MediaUploader purpose="build_update" className="aspect-[16/10]" label="After photo" onUploaded={setAfter} />
            )}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Cost" optional help="Only shown publicly if you enabled expense sharing.">
            {(p) => <Input {...p} type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />}
          </Field>
          <Field label="Currency">{(p) => <Input {...p} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />}</Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!title.trim()}>
            Post update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BuildTimeline({ vehicle }: { vehicle: VehicleDetail }) {
  const locale = useLocale();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const updates = useInfiniteQuery({
    queryKey: queryKeys.vehicleUpdates(vehicle.id),
    queryFn: ({ pageParam }) => api.vehicles.updates(vehicle.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.vehicles.deleteUpdate(vehicle.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.vehicleUpdates(vehicle.id) }),
  });
  const items: BuildUpdate[] = updates.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Build timeline</h2>
        {vehicle.viewer.isOwner && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden="true" /> Add update
          </Button>
        )}
      </div>
      {items.length === 0 && !updates.isLoading && <p className="text-sm text-muted">No build updates yet.</p>}
      <ol className="relative grid gap-6 border-l border-line pl-6">
        {items.map((u) => (
          <li key={u.id} className="relative grid gap-2">
            <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full bg-accent ring-4 ring-bg" aria-hidden="true" />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone={u.kind === 'milestone' ? 'accent' : u.kind === 'dyno' ? 'info' : 'neutral'}>{BUILD_KIND_LABELS[u.kind]}</Badge>
              <time dateTime={u.occurredAt}>{formatDate(u.occurredAt, locale)}</time>
              {u.cost && (
                <span>
                  · {new Intl.NumberFormat(locale, { style: 'currency', currency: u.cost.currency, maximumFractionDigits: 0 }).format(u.cost.amount)}
                </span>
              )}
              {vehicle.viewer.isOwner && (
                <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label="Delete update" onClick={() => remove.mutate(u.id)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              )}
            </div>
            <h3 className="font-semibold">{u.title}</h3>
            {u.body && <Markdown text={u.body} blocks className="text-sm text-muted" />}
            {u.before && u.after && <BeforeAfter before={u.before} after={u.after} />}
            {u.media.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {u.media.map((m) =>
                  m.kind === 'video' ? (
                    <video key={m.id} src={m.url} poster={m.thumbnailUrl ?? undefined} controls preload="none" className="aspect-square w-full rounded-md object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.id} src={mediaUrl(m, { width: 400, height: 400, crop: 'fill' })} alt="" loading="lazy" className="aspect-square rounded-md object-cover" />
                  ),
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      {updates.hasNextPage && (
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => void updates.fetchNextPage()} loading={updates.isFetchingNextPage}>
          Load more
        </Button>
      )}
      {vehicle.viewer.isOwner && <AddUpdateDialog vehicleId={vehicle.id} open={open} onOpenChange={setOpen} />}
    </section>
  );
}
