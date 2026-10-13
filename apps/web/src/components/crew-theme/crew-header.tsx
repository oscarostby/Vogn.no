import { headerFallbackGradient, type ResolvedTheme } from '@vogn/theme-engine';
import type { MediaRef } from '@vogn/types';
import { compactNumber, countryFlag } from '@vogn/utils';
import { Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/media';

export interface HeaderCrew {
  name: string;
  description: string | null;
  icon: MediaRef | null;
  banner: MediaRef | null;
  memberCount: number;
  region: string | null;
  country: string | null;
  categoryLabel: string;
}

const HEIGHTS = { sm: 'min-h-36 md:min-h-40', md: 'min-h-44 md:min-h-56', lg: 'min-h-52 md:min-h-72', xl: 'min-h-60 md:min-h-[22rem]' } as const;

function CrewIcon({ crew, size = 72, theme }: { crew: HeaderCrew; size?: number; theme: ResolvedTheme }) {
  const shape = theme.manifest.components.avatarShape;
  const radius = shape === 'circle' ? '9999px' : shape === 'rounded' ? `${Math.round(size * 0.24)}px` : 'var(--ct-radius-sm)';
  return crew.icon ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(crew.icon, { width: size * 2, height: size * 2, crop: 'fill' })}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-cover shadow-[0_0_0_3px_var(--ct-bg)]"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="ct-heading flex shrink-0 items-center justify-center shadow-[0_0_0_3px_var(--ct-bg)]"
      style={{ width: size, height: size, borderRadius: radius, background: 'var(--ct-primary)', color: 'var(--ct-primary-contrast)', fontSize: size * 0.38 }}
    >
      {crew.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Meta({ crew, theme, online }: { crew: HeaderCrew; theme: ResolvedTheme; online?: number | null }) {
  if (!theme.manifest.header.showStats) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ct-muted)]">
      <span className="inline-flex items-center gap-1.5">
        <Users className="size-3.5" aria-hidden="true" />
        {compactNumber(crew.memberCount)} members
      </span>
      {typeof online === 'number' && (
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--ct-success)]" aria-hidden="true" />
          {compactNumber(online)} online
        </span>
      )}
      {(crew.region || crew.country) && (
        <span>
          {crew.country ? `${countryFlag(crew.country)} ` : ''}
          {crew.region ?? crew.country}
        </span>
      )}
      <span className="ct-badge">{crew.categoryLabel}</span>
    </div>
  );
}

function Banner({ crew, theme, className, overlay }: { crew: HeaderCrew; theme: ResolvedTheme; className?: string; overlay?: number }) {
  const o = overlay ?? theme.manifest.header.overlayOpacity;
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ background: crew.banner ? undefined : headerFallbackGradient(theme) }}>
      {crew.banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(crew.banner, { width: 1600, crop: 'fill' })} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, var(--ct-bg) 0%, color-mix(in srgb, var(--ct-bg) ${Math.round(o * 100)}%, transparent) 45%, transparent 100%)` }} />
    </div>
  );
}

function Decorative({ theme }: { theme: ResolvedTheme }) {
  const { decorativeText, decorativeStyle } = theme.manifest.header;
  if (!decorativeText || decorativeStyle === 'none') return null;
  if (decorativeStyle === 'vertical') {
    return (
      <span
        aria-hidden="true"
        className="ct-heading pointer-events-none absolute top-6 right-6 hidden text-3xl leading-none tracking-[0.3em] text-[var(--ct-primary)] opacity-80 [writing-mode:vertical-rl] md:block lg:text-4xl"
        style={{ textShadow: '0 0 18px color-mix(in srgb, var(--ct-primary) 60%, transparent)' }}
      >
        {decorativeText}
      </span>
    );
  }
  if (decorativeStyle === 'outline') {
    return (
      <span
        aria-hidden="true"
        className="ct-heading pointer-events-none absolute top-4 right-6 hidden text-6xl text-transparent opacity-60 md:block"
        style={{ WebkitTextStroke: '1px var(--ct-muted)' }}
      >
        {decorativeText}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="ct-heading pointer-events-none absolute top-5 right-5 hidden rotate-[-8deg] border-2 px-3 py-1 text-sm tracking-[0.2em] uppercase opacity-80 md:block"
      style={{ borderColor: 'var(--ct-accent)', color: 'var(--ct-accent-text)' }}
    >
      {decorativeText}
    </span>
  );
}

export function CrewHeader({
  crew,
  theme,
  actions,
  online,
  compact = false,
}: {
  crew: HeaderCrew;
  theme: ResolvedTheme;
  actions?: ReactNode;
  online?: number | null;
  compact?: boolean;
}) {
  const h = theme.manifest.header;
  const height = compact ? 'min-h-36' : HEIGHTS[h.height];
  const tagline = h.tagline ?? crew.description;
  const center = h.align === 'center';

  switch (h.style) {
    case 'minimal':
      return (
        <header className="relative flex flex-wrap items-center gap-4 border-b border-[var(--ct-border)] px-5 py-6 md:px-8">
          {h.showIcon && <CrewIcon crew={crew} theme={theme} size={56} />}
          <div className="grid min-w-0 flex-1 gap-1.5">
            <h1 className="ct-heading text-2xl md:text-3xl" style={{ fontSize: 'calc(1.9rem * var(--ct-type-scale))' }}>
              {crew.name}
            </h1>
            {tagline && <p className="max-w-2xl text-sm text-[var(--ct-muted)]">{tagline}</p>}
            <Meta crew={crew} theme={theme} online={online} />
          </div>
          {actions}
        </header>
      );

    case 'editorial':
      return (
        <header className="relative px-5 pt-10 pb-6 md:px-8">
          <Decorative theme={theme} />
          <div className={cn('mx-auto grid max-w-3xl gap-4', center && 'text-center')}>
            <p className="text-[11px] font-semibold tracking-[0.3em] text-[var(--ct-muted)] uppercase">{crew.categoryLabel}</p>
            <h1 className="ct-heading" style={{ fontSize: 'calc(clamp(2.4rem, 6vw, 4.2rem) * var(--ct-type-scale))' }}>
              {crew.name}
            </h1>
            <div className="ct-divider mx-auto w-24" />
            {tagline && <p className="text-lg text-[var(--ct-muted)] italic">{tagline}</p>}
            <div className={cn('flex flex-wrap items-center gap-3', center && 'justify-center')}>{actions}</div>
          </div>
          {!compact && <Banner crew={crew} theme={theme} className="mt-8 h-48 md:h-72" overlay={0} />}
        </header>
      );

    case 'split':
      return (
        <header className="relative grid gap-6 px-5 py-6 md:grid-cols-[1.1fr_1fr] md:items-center md:px-8 md:py-10">
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              {h.showIcon && <CrewIcon crew={crew} theme={theme} size={52} />}
              <span className="ct-badge">{crew.categoryLabel}</span>
            </div>
            <h1 className="ct-heading" style={{ fontSize: 'calc(clamp(2.2rem, 5vw, 3.6rem) * var(--ct-type-scale))' }}>
              {crew.name}
            </h1>
            {tagline && <p className="max-w-xl text-[var(--ct-muted)]">{tagline}</p>}
            <Meta crew={crew} theme={theme} online={online} />
            <div className="flex flex-wrap gap-2">{actions}</div>
          </div>
          <div className="relative">
            <Banner crew={crew} theme={theme} className={cn('ct-card aspect-[4/3] md:aspect-[5/4]', compact && 'hidden')} overlay={0.1} />
            <Decorative theme={theme} />
          </div>
        </header>
      );

    case 'plate':
      return (
        <header className={cn('relative overflow-hidden', height)}>
          <Banner crew={crew} theme={theme} className="absolute inset-0" />
          <Decorative theme={theme} />
          <div className="relative flex h-full flex-col justify-end gap-4 px-5 pt-16 pb-6 md:px-8">
            <div className="inline-flex w-fit items-center gap-4 border-[3px] border-[var(--ct-text)] bg-[var(--ct-bg)] px-4 py-3 shadow-[6px_6px_0_0_var(--ct-primary)]">
              {h.showIcon && <CrewIcon crew={crew} theme={theme} size={48} />}
              <h1 className="ct-heading leading-none" style={{ fontSize: 'calc(clamp(2.2rem, 6vw, 4rem) * var(--ct-type-scale))' }}>
                {crew.name}
              </h1>
            </div>
            {tagline && <p className="max-w-2xl font-medium">{tagline}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Meta crew={crew} theme={theme} online={online} />
              <div className="flex gap-2">{actions}</div>
            </div>
          </div>
        </header>
      );

    case 'fullbleed':
      return (
        <header className={cn('relative overflow-hidden', height)}>
          <Banner crew={crew} theme={theme} className="absolute inset-0" />
          <Decorative theme={theme} />
          <div className={cn('relative flex h-full flex-col justify-end gap-4 px-5 pt-24 pb-7 md:px-10', center && 'items-center text-center')}>
            {h.showIcon && <CrewIcon crew={crew} theme={theme} size={64} />}
            <h1 className="ct-heading max-w-4xl" style={{ fontSize: 'calc(clamp(2.4rem, 7vw, 4.8rem) * var(--ct-type-scale))' }}>
              {crew.name}
            </h1>
            {tagline && <p className="max-w-2xl text-[var(--ct-muted)] md:text-lg">{tagline}</p>}
            <div className={cn('flex w-full flex-wrap items-center justify-between gap-3', center && 'justify-center')}>
              <Meta crew={crew} theme={theme} online={online} />
              <div className="flex gap-2">{actions}</div>
            </div>
          </div>
        </header>
      );

    default:
      return (
        <header className="relative">
          <Banner crew={crew} theme={theme} className={cn(compact ? 'h-28' : 'h-40 md:h-56')} />
          <Decorative theme={theme} />
          <div className={cn('relative -mt-10 flex flex-wrap items-end gap-4 px-5 pb-5 md:px-8', center && 'flex-col items-center text-center')}>
            {h.showIcon && <CrewIcon crew={crew} theme={theme} size={84} />}
            <div className="grid min-w-0 flex-1 gap-1.5">
              <h1 className="ct-heading" style={{ fontSize: 'calc(clamp(1.8rem, 4vw, 2.6rem) * var(--ct-type-scale))' }}>
                {crew.name}
              </h1>
              {tagline && <p className="max-w-2xl text-sm text-[var(--ct-muted)]">{tagline}</p>}
              <Meta crew={crew} theme={theme} online={online} />
            </div>
            <div className="flex gap-2">{actions}</div>
          </div>
        </header>
      );
  }
}
