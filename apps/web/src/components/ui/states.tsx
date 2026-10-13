'use client';

import { isApiError } from '@vogn/api-client';
import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Skeleton } from './display';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line px-6 py-12 text-center', className)}>
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-xl bg-elevated text-muted">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div className="grid max-w-sm gap-1">
        <p className="text-[15px] font-semibold">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function useErrorMessage() {
  const t = useTranslations('errors');
  return (error: unknown) => {
    if (isApiError(error)) {
      if (t.has(error.code)) return t(error.code);
      return error.message;
    }
    return t('INTERNAL');
  };
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = useErrorMessage()(error);
  const t = useTranslations('common');
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-6 py-10 text-center', className)}>
      <AlertTriangle className="size-6 text-warning" aria-hidden="true" />
      <p className="max-w-sm text-sm text-fg">{message}</p>
      {requestId && <p className="font-mono text-[11px] text-subtle">ref {requestId.slice(0, 8)}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('grid gap-3', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4 pb-6', className)}>
      <div className="grid min-w-0 gap-1.5">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.14em] text-accent-text uppercase">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance md:text-[28px]">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
