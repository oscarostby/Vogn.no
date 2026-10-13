'use client';

import { isApiError, uploadMedia } from '@vogn/api-client';
import type { MeProfile, OnboardingState } from '@vogn/types';
import type { MediaSignInput } from '@vogn/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api, queryKeys } from './api';
import { shrinkImage } from './shrink-image';

export function isOnboarding(me: MeProfile | OnboardingState | undefined): me is OnboardingState {
  return Boolean(me && 'needsOnboarding' in me);
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.me.get(), staleTime: 60_000 });
}

/** Returns the profile once onboarded; undefined while loading or onboarding. */
export function useProfile(): MeProfile | undefined {
  const { data } = useMe();
  return data && !isOnboarding(data) ? data : undefined;
}

export function useUnreadCount() {
  return useQuery({ queryKey: queryKeys.unread, queryFn: () => api.notifications.unreadCount(), refetchInterval: 60_000 });
}

export function useMyCrews() {
  return useQuery({ queryKey: queryKeys.myCrews, queryFn: () => api.crews.mine(), staleTime: 30_000 });
}

export interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
}

/** Signed direct upload to the media CDN, verified and registered by the API. Oversized photos are shrunk first. */
export function useMediaUpload() {
  const [state, setState] = useState<UploadState>({ uploading: false, progress: 0, error: null });
  const upload = useCallback(async (original: File, purpose: MediaSignInput['purpose'], contextId?: string) => {
    setState({ uploading: true, progress: 0, error: null });
    try {
      const file = await shrinkImage(original);
      const result = await uploadMedia(
        api,
        { purpose, mime: file.type as MediaSignInput['mime'], size: file.size, filename: file.name, contextId },
        (form) => form.append('file', file),
      );
      setState({ uploading: false, progress: 1, error: null });
      return result;
    } catch (error) {
      const message = isApiError(error) ? error.message : 'Upload failed';
      setState({ uploading: false, progress: 0, error: message });
      throw error;
    }
  }, []);
  return { ...state, upload };
}

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback((key: readonly unknown[]) => qc.invalidateQueries({ queryKey: key }), [qc]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}
