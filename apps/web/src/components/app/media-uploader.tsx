'use client';

import type { UploadedMedia } from '@vogn/api-client';
import type { MediaSignInput } from '@vogn/validation';
import { ImagePlus, Loader2 } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { toast } from 'sonner';
import { useErrorMessage } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useMediaUpload } from '@/lib/hooks';

const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic';
const ACCEPT_MEDIA = `${ACCEPT_IMAGES},video/mp4,video/quicktime,video/webm`;

export function useUploadPicker(purpose: MediaSignInput['purpose'], onUploaded: (m: UploadedMedia) => void, contextId?: string) {
  const { upload, uploading } = useMediaUpload();
  const errorMessage = useErrorMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        onUploaded(await upload(file, purpose, contextId));
      } catch (error) {
        toast.error(errorMessage(error));
        break;
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };
  return { inputRef, uploading, handleFiles, open: () => inputRef.current?.click() };
}

/** Dropzone-style uploader that hands back verified media references. */
export function MediaUploader({
  purpose,
  onUploaded,
  contextId,
  multiple = false,
  accept = 'images',
  className,
  children,
  label = 'Upload',
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
  const { inputRef, uploading, handleFiles, open } = useUploadPicker(purpose, onUploaded, contextId);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={accept === 'images' ? ACCEPT_IMAGES : ACCEPT_MEDIA}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={open}
        disabled={uploading}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-sunken p-4 text-sm text-muted transition hover:border-accent-text hover:text-fg disabled:cursor-wait disabled:opacity-60',
          className,
        )}
      >
        {children ?? (
          <>
            {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-5" aria-hidden="true" />}
            <span>{uploading ? 'Uploading…' : label}</span>
          </>
        )}
      </button>
    </>
  );
}
