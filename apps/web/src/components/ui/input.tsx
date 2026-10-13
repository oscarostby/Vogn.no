import { type ComponentProps, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export const inputClass =
  'flex h-10 w-full min-w-0 rounded-lg border border-line bg-sunken px-3 text-sm text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus-visible:border-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--vogn-ring)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function Input({ className, type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed', className)} {...props} />;
});

export const NativeSelect = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(function NativeSelect({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputClass, 'appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});
