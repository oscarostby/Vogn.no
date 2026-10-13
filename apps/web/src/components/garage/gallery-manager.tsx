'use client';

import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MediaRef, VehicleDetail } from '@vogn/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Play, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media';
import { UploadButton, useUploadPicker } from '../app/media-uploader';

function Tile({ media, onRemove }: { media: MediaRef; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative aspect-square overflow-hidden rounded-lg border border-line bg-elevated ${isDragging ? 'z-10 opacity-80 shadow-card' : ''}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(media.kind === 'video' && media.thumbnailUrl ? media.thumbnailUrl : media, { width: 300, height: 300, crop: 'fill' })} alt="" className="size-full object-cover" />
      {media.kind === 'video' && <Play className="absolute top-2 left-2 size-4 text-white drop-shadow" aria-label="Video" />}
      <button type="button" {...attributes} {...listeners} aria-label="Drag to reorder" className="absolute top-1.5 right-1.5 rounded-md bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onRemove} aria-label="Remove from gallery" className="absolute right-1.5 bottom-1.5 rounded-md bg-black/50 p-1 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

/** Ordered photo/video gallery with drag-and-drop (keyboard accessible). */
export function GalleryManager({ vehicle }: { vehicle: VehicleDetail }) {
  const qc = useQueryClient();
  const errorMessage = useErrorMessage();
  const [items, setItems] = useState<MediaRef[]>(vehicle.gallery);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const save = useMutation({
    mutationFn: (list: MediaRef[]) => api.vehicles.setGallery(vehicle.id, list.map((m) => m.id)),
    onSuccess: (v) => qc.setQueryData(queryKeys.vehicle(v.id), v),
    onError: (e) => toast.error(errorMessage(e)),
  });
  // Several files dropped at once finish one after another; each must extend the list the previous one saved.
  const latest = useRef(items);
  const commit = (list: MediaRef[]) => {
    latest.current = list;
    setItems(list);
    save.mutate(list);
  };
  const add = useUploadPicker('vehicle', (m) => commit([...latest.current, m]), { accept: 'media', multiple: true, disabled: items.length >= 60 });
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((m) => m.id === e.active.id);
    const to = items.findIndex((m) => m.id === e.over!.id);
    commit(arrayMove(items, from, to));
  };
  return (
    <section {...add.dropProps} className={cn('grid gap-4 rounded-xl border border-line bg-surface p-5 transition md:p-6', add.dragging && 'border-dashed border-accent-text bg-accent-muted')}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Gallery</h2>
          <p className="text-sm text-muted">Up to 60 photos and videos. Drop files here to add them. Drag to reorder — the first image is used when no cover is set.</p>
        </div>
        {save.isPending && <span className="text-xs text-muted">Saving…</span>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((m) => (
              <Tile key={m.id} media={m} onRemove={() => commit(items.filter((x) => x.id !== m.id))} />
            ))}
            {items.length < 60 && (
              <UploadButton picker={add} className="aspect-square" label="Add" />
            )}
          </div>
        </SortableContext>
      </DndContext>
      {items.length > 0 && (
        <p className="text-xs text-subtle">
          Removing an item deletes it from our media storage. <Button variant="link" size="xs" type="button" onClick={() => commit([])}>Clear gallery</Button>
        </p>
      )}
    </section>
  );
}
