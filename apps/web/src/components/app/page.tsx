import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Standard content container for app pages. */
export function PageContainer({ children, className, width = 'normal' }: { children: ReactNode; className?: string; width?: 'narrow' | 'normal' | 'wide' }) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 md:px-8 md:py-8', width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-[1400px]' : 'max-w-6xl', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, action, className }: { title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}
