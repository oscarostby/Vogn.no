import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { type ComponentProps, forwardRef } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

export const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-[color-mix(in_srgb,var(--vogn-accent)_88%,white)] shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]',
        secondary: 'bg-elevated text-fg border border-line hover:border-line-strong hover:bg-[color-mix(in_srgb,var(--vogn-elevated)_80%,var(--vogn-fg)_6%)]',
        outline: 'border border-line-strong text-fg hover:bg-elevated',
        ghost: 'text-muted hover:text-fg hover:bg-elevated',
        danger: 'bg-danger text-danger-fg hover:brightness-110',
        'danger-ghost': 'text-danger hover:bg-[color-mix(in_srgb,var(--vogn-danger)_12%,transparent)]',
        link: 'text-accent-text underline-offset-4 hover:underline px-0! h-auto!',
      },
      size: {
        xs: 'h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-8 rounded-md px-3 text-[13px] [&_svg]:size-4',
        md: 'h-10 rounded-lg px-4 text-sm [&_svg]:size-4',
        lg: 'h-12 rounded-lg px-6 text-[15px] [&_svg]:size-5',
        icon: 'size-9 rounded-lg [&_svg]:size-[18px]',
        'icon-sm': 'size-8 rounded-md [&_svg]:size-4',
        'icon-xs': 'size-6 rounded-md [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Spinner className="absolute" />}
          <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
        </>
      )}
    </Comp>
  );
});
