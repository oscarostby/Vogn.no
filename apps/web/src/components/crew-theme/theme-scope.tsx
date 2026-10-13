import { backgroundStyle, resolveTheme, type ResolvedTheme, type ThemeManifest, themeCssVariables } from '@vogn/theme-engine';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ThemeScopeProps {
  manifest: ThemeManifest;
  mode?: 'dark' | 'light';
  reducedMotion?: boolean;
  className?: string;
  children: ReactNode;
  /** Apply the page background (off for embedded previews that draw their own frame). */
  withBackground?: boolean;
  /** Pre-resolved theme (avoids resolving twice). */
  resolved?: ResolvedTheme;
}

/**
 * Applies a validated crew theme to a subtree via CSS custom properties and data attributes. Nothing from
 * the manifest is ever injected as raw CSS or HTML.
 */
export function CrewThemeScope({ manifest, mode, reducedMotion, className, children, withBackground = true, resolved }: ThemeScopeProps) {
  const theme = resolved ?? resolveTheme(manifest, { mode, reducedMotion });
  const vars = themeCssVariables(theme) as CSSProperties;
  const bg = withBackground ? backgroundStyle(theme) : { backgroundColor: theme.colors.background };
  const m = theme.manifest;
  const style = {
    ...vars,
    ...bg,
    ['--ct-effect-intensity' as string]: String(m.background.effectIntensity),
    colorScheme: theme.mode,
  } as CSSProperties;

  return (
    <div
      className={cn('crew-theme relative isolate', className)}
      style={style}
      data-mode={theme.mode}
      data-card={m.components.card}
      data-button={m.components.button}
      data-badge={m.components.badge}
      data-divider={m.components.divider}
      data-input={m.components.input}
      data-hover-lift={m.motion.hoverLift && theme.motionEnabled ? 'true' : 'false'}
    >
      {withBackground && m.background.type === 'video' && m.background.videoUrl && theme.motionEnabled && (
        <video
          className="pointer-events-none absolute inset-0 -z-10 size-full object-cover"
          src={m.background.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          style={{ filter: m.background.blur ? `blur(${m.background.blur}px)` : undefined, opacity: 1 - m.background.overlayOpacity }}
        />
      )}
      {withBackground && theme.effectsEnabled && <div className={`ct-effect ct-effect--${m.background.effect} -z-10`} aria-hidden="true" />}
      {children}
    </div>
  );
}
