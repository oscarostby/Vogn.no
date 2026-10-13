import type { MediaRef, PublicBadge } from '@vogn/types';
import { initials } from '@vogn/utils';
import { BadgeCheck, Car, IdCard, KeyRound, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import Image from 'next/image';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: ComponentProps<'span'> & { tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap [&_svg]:size-3',
        {
          neutral: 'bg-elevated text-muted ring-1 ring-line ring-inset',
          accent: 'bg-accent-muted text-accent-text',
          success: 'bg-[color-mix(in_srgb,var(--vogn-success)_14%,transparent)] text-success',
          warning: 'bg-[color-mix(in_srgb,var(--vogn-warning)_14%,transparent)] text-warning',
          danger: 'bg-[color-mix(in_srgb,var(--vogn-danger)_14%,transparent)] text-danger',
          info: 'bg-[color-mix(in_srgb,var(--vogn-info)_14%,transparent)] text-info',
        }[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse-soft rounded-md bg-elevated', className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-line', className)} />;
}

const AVATAR_SIZES = { xs: 20, sm: 28, md: 36, lg: 48, xl: 72, '2xl': 112 } as const;

export function Avatar({
  name,
  image,
  size = 'md',
  shape = 'circle',
  accent,
  className,
  status,
}: {
  name: string;
  image: MediaRef | null | undefined;
  size?: keyof typeof AVATAR_SIZES;
  shape?: 'circle' | 'rounded' | 'square';
  accent?: string | null;
  className?: string;
  status?: 'online' | null;
}) {
  const px = AVATAR_SIZES[size];
  const radius = shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-[28%]' : 'rounded-md';
  return (
    <span className={cn('relative inline-flex shrink-0', className)} style={{ width: px, height: px }}>
      {image ? (
        <Image
          src={mediaUrl(image, { width: px * 2, height: px * 2, crop: 'fill' })}
          alt=""
          width={px}
          height={px}
          className={cn('size-full object-cover', radius)}
          unoptimized
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn('flex size-full items-center justify-center font-semibold text-fg', radius)}
          style={{
            fontSize: Math.max(9, Math.round(px * 0.38)),
            background: accent ? `color-mix(in srgb, ${accent} 30%, var(--vogn-elevated))` : 'var(--vogn-elevated)',
          }}
        >
          {initials(name)}
        </span>
      )}
      {status === 'online' && (
        <span className="absolute right-0 bottom-0 size-[30%] min-h-2 min-w-2 rounded-full border-2 border-surface bg-success" />
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

const BADGE_ICONS: Record<PublicBadge, typeof Mail> = {
  email_verified: Mail,
  phone_verified: Smartphone,
  identity_checked: IdCard,
  vehicle_specs_confirmed: Car,
  vehicle_access_reviewed: KeyRound,
  ownership_evidence_reviewed: ShieldCheck,
  staff: BadgeCheck,
};

const BADGE_LABELS: Record<PublicBadge, string> = {
  email_verified: 'Email verified',
  phone_verified: 'Phone verified',
  identity_checked: 'Identity checked',
  vehicle_specs_confirmed: 'Vehicle specs confirmed',
  vehicle_access_reviewed: 'Vehicle access reviewed',
  ownership_evidence_reviewed: 'Ownership evidence reviewed',
  staff: 'VOGN staff',
};

export function VerificationBadges({ badges, compact = false }: { badges: PublicBadge[]; compact?: boolean }) {
  const shown = badges.filter((b) => b !== 'email_verified');
  if (!shown.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((badge) => {
        const Icon = BADGE_ICONS[badge];
        return compact ? (
          <span key={badge} title={BADGE_LABELS[badge]} className="text-accent-text">
            <Icon className="size-3.5" aria-label={BADGE_LABELS[badge]} />
          </span>
        ) : (
          <Badge key={badge} tone={badge === 'staff' ? 'accent' : 'info'}>
            <Icon aria-hidden="true" />
            {BADGE_LABELS[badge]}
          </Badge>
        );
      })}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-sunken px-1 font-mono text-[10px] text-muted">
      {children}
    </kbd>
  );
}
