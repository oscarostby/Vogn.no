import Image from 'next/image';
import { cn } from '@/lib/cn';

const ART = {
  mark: { dark: '/brand/vogn-mark-white.png', light: '/brand/vogn-mark-black.png', ratio: 2.55 },
  wordmark: { dark: '/brand/vogn-wordmark-white.png', light: '/brand/vogn-wordmark-black.png', ratio: 1.83 },
  text: { dark: '/brand/vogn-text-white.png', light: '/brand/vogn-text-black.png', ratio: 7.1 },
} as const;

function Art({ kind, height, forceDark, priority }: { kind: keyof typeof ART; height: number; forceDark: boolean; priority: boolean }) {
  const a = ART[kind];
  const width = Math.round(height * a.ratio);
  const style = { height, width: 'auto' } as const;
  return (
    <>
      <Image src={a.dark} alt="" width={width} height={height} priority={priority} style={style} className={cn('object-contain', !forceDark && 'logo-on-dark')} />
      {!forceDark && <Image src={a.light} alt="" width={width} height={height} priority={priority} style={style} className="logo-on-light object-contain" />}
    </>
  );
}

/**
 * VOGN brand artwork from the official logo files. Follows the active colour scheme unless `forceDark`.
 * - `mark`: the V symbol
 * - `wordmark`: stacked symbol + lettering
 * - `lockup`: symbol and lettering side by side (navigation bars)
 */
export function Logo({
  variant = 'mark',
  height = 20,
  className,
  forceDark = false,
  priority = false,
}: {
  variant?: 'mark' | 'wordmark' | 'lockup';
  height?: number;
  className?: string;
  forceDark?: boolean;
  priority?: boolean;
}) {
  return (
    <span role="img" aria-label="VOGN" className={cn('inline-flex shrink-0 items-center', variant === 'lockup' && 'gap-2.5', className)}>
      {variant === 'lockup' ? (
        <>
          <Art kind="mark" height={height} forceDark={forceDark} priority={priority} />
          <Art kind="text" height={Math.round(height * 0.62)} forceDark={forceDark} priority={priority} />
        </>
      ) : (
        <Art kind={variant} height={height} forceDark={forceDark} priority={priority} />
      )}
    </span>
  );
}
