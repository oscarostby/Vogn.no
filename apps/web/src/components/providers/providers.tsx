'use client';

import { isApiError } from '@vogn/api-client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error)) {
    if (['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_FAILED', 'ONBOARDING_REQUIRED', 'CONFIG_MISSING'].includes(error.code)) {
      return false;
    }
  }
  return failureCount < 2;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
        queryCache: new QueryCache(),
        mutationCache: new MutationCache(),
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster
          position="bottom-right"
          theme="system"
          toastOptions={{
            classNames: {
              toast: 'bg-elevated! text-fg! border-line! shadow-card!',
              description: 'text-muted!',
            },
          }}
        />
      </MotionConfig>
    </QueryClientProvider>
  );
}
