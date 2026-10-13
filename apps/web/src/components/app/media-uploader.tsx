'use client';

import type { UploadedMedia } from '@vogn/api-client';
import type { MediaSignInput } from '@vogn/validation';
import { ImagePlus, Loader2 } from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useErrorMessage } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useMediaUpload } from '@/lib/hooks';

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic';
const ACCEPT_MEDIA = `${ACCEPT_IMAGES},video/mp4,video/quicktime,video/webm`;

/** Images dragged within the page can carry "Files" too; only drags from outside the page should upload. */
let draggingFromPage = false;

function carriesFiles(event: { dataTransfer: DataTransfer | null }): boolean {
  return !draggingFromPage && Boolean(event.dataTransfer?.types.includes('Files'));
}

/**
 * Native file drop target. Counting enter/leave keeps the highlight steady over child elements, the innermost
 * target takes a drop, and while one is mounted, files dropped beside it no longer open in the tab.
 */
function useFileDrop(onFiles: (files: File[]) => void, disabled: boolean) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  useEffect(() => {
    const track = (event: Event) => {
      draggingFromPage = event.type === 'dragstart';
    };
    const ignore = (event: globalThis.DragEvent) => {
      if (event.defaultPrevented || !carriesFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
    };
    window.addEventListener('dragstart', track);
    window.addEventListener('dragend', track);
    window.addEventListener('dragover', ignore);
    window.addEventListener('drop', ignore);
    return () => {
      window.removeEventListener('dragstart', track);
      window.removeEventListener('dragend', track);
      window.removeEventListener('dragover', ignore);
      window.removeEventListener('drop', ignore);
    };
  }, []);
  const leave = () => {
    depth.current = 0;
    setOver(false);
  };
  const dropProps = {
    onDragEnter: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth.current += 1;
      setOver(true);
    },
    onDragLeave: (event: DragEvent) => {
      if (carriesFiles(event) && --depth.current <= 0) leave();
    },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event) || event.defaultPrevented) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? 'none' : 'copy';
    },
    onDrop: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      leave();
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (!disabled) onFiles(Array.from(event.dataTransfer.files));
    },
  };
  return { dragging: over && !disabled, dropProps };
}

export interface UploadPickerOptions {
  contextId?: string;
  multiple?: boolean;
  accept?: 'images' | 'media';
  /** Ignore drops, e.g. while the surrounding form is busy. */
  disabled?: boolean;
}

/** File picker and drop target for one upload purpose. Spread `dropProps` on any element that should take files. */
export function useUploadPicker(
  purpose: MediaSignInput['purpose'],
  onUploaded: (m: UploadedMedia) => void,
  { contextId, multiple = false, accept = 'images', disabled = false }: UploadPickerOptions = {},
) {
  const { upload, uploading } = useMediaUpload();
  const errorMessage = useErrorMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const types = accept === 'images' ? ACCEPT_IMAGES : ACCEPT_MEDIA;
  const handleFiles = async (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    const usable = files.filter((file) => types.split(',').includes(file.type));
    if (usable.length < files.length) toast.error(accept === 'images' ? 'Only images can be uploaded here.' : 'Only images and videos can be uploaded here.');
    for (const file of multiple ? usable : usable.slice(0, 1)) {
      try {
        onUploaded(await upload(file, purpose, contextId));
      } catch (error) {
        toast.error(errorMessage(error));
        break;
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };
  const { dragging, dropProps } = useFileDrop((files) => void handleFiles(files), uploading || disabled);
  const input = <input ref={inputRef} type="file" hidden multiple={multiple} accept={types} onChange={(e) => void handleFiles(e.target.files)} />;
  return { input, uploading, dragging, dropProps, open: () => inputRef.current?.click() };
}

/** Dashed click-or-drop button for a picker, which may also serve a larger drop area around it. */
export function UploadButton({
  picker,
  className,
  children,
  label = 'Upload',
}: {
  picker: ReturnType<typeof useUploadPicker>;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const { input, uploading, dragging, dropProps, open } = picker;
  return (
    <>
      {input}
      <button
        type="button"
        onClick={() => !uploading && open()}
        aria-disabled={uploading}
        {...dropProps}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-sunken p-4 text-sm text-muted transition hover:border-accent-text hover:text-fg aria-disabled:cursor-wait aria-disabled:opacity-60',
          className,
          dragging && 'border-accent-text bg-accent-muted text-fg',
        )}
      >
        {children ?? (
          <>
            {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
            <span>{uploading ? 'Uploading…' : dragging ? 'Drop to upload' : label}</span>
          </>
        )}
      </button>
    </>
  );
}

/** Click-or-drop uploader that hands back verified media references. */
export function MediaUploader({
  purpose,
  onUploaded,
  contextId,
  multiple = false,
  accept = 'images',
  className,
  children,
  label,
}: {
  purpose: MediaSignInput['purpose'];
  onUploaded: (m: UploadedMedia) => void;
  contextId?: string;
  multiple?: boolean;
  accept?: 'images' | 'media';
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const picker = useUploadPicker(purpose, onUploaded, { contextId, multiple, accept });
  return (
    <UploadButton picker={picker} className={className} label={label}>
      {children}
    </UploadButton>
  );
}
