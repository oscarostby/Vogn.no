'use client';

import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioPrimitive, Switch as SwitchPrimitive, Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-sunken p-0.5 transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4.5 rounded-full bg-muted shadow transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-fg" />
    </SwitchPrimitive.Root>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-3">
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-line-strong bg-sunken transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className={cn('grid gap-2', className)} {...props} />;
}

export function RadioCard({
  value,
  title,
  description,
  icon,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <RadioPrimitive.Item
      value={value}
      className="group flex w-full items-start gap-3 rounded-lg border border-line bg-sunken p-3 text-left transition hover:border-line-strong data-[state=checked]:border-accent-text data-[state=checked]:bg-[color-mix(in_srgb,var(--vogn-accent)_8%,transparent)]"
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong group-data-[state=checked]:border-accent-text">
        <RadioPrimitive.Indicator className="size-2 rounded-full bg-accent-text" />
      </span>
      {icon && <span className="text-muted [&_svg]:size-5">{icon}</span>}
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </span>
    </RadioPrimitive.Item>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('scrollbar-none inline-flex max-w-full items-center gap-1 overflow-x-auto border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap text-muted transition hover:text-fg data-[state=active]:border-accent-text data-[state=active]:text-fg [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}
