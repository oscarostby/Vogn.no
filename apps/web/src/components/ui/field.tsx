'use client';

import { useTranslations } from 'next-intl';
import { Label as LabelPrimitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-[13px] font-medium text-fg select-none', className)} {...props} />;
}

/** Translates validation keys (`validation.*`) coming from Zod or the API; passes plain text through. */
export function useErrorText() {
  const t = useTranslations();
  return (message: string | undefined | null) => {
    if (!message) return null;
    if (/^validation\.[\w.]+$/.test(message) && t.has(message)) return t(message);
    return message;
  };
}

interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}

export function Field({ label, help, error, optional, className, children }: FieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const errorText = useErrorText()(error);
  const t = useTranslations('common');
  const describedBy = [help ? helpId : null, errorText ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className="text-xs text-subtle">{t('optional')}</span>}
      </div>
      {children({ id, 'aria-invalid': errorText ? true : undefined, 'aria-describedby': describedBy })}
      {help && !errorText && (
        <p id={helpId} className="text-xs text-muted">
          {help}
        </p>
      )}
      {errorText && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {errorText}
        </p>
      )}
    </div>
  );
}
