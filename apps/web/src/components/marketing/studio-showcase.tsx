'use client';

import { resolveTheme, THEME_PRESET_IDS, THEME_PRESETS, type ThemePresetId } from '@vogn/theme-engine';
import { ArrowRight, Monitor, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CrewHeader } from '@/components/crew-theme/crew-header';
import { PageRenderer } from '@/components/crew-theme/page-renderer';
import { CrewThemeScope } from '@/components/crew-theme/theme-scope';
import { ThemeIcon } from '@/components/crew-theme/theme-icon';
import { cn } from '@/lib/cn';
import { SAMPLE_CREWS, sampleWidgetData } from './showcase-fixtures';

/** Live preview of the real theme renderer with each preset (sample content). */
export function StudioShowcase() {
  const [preset, setPreset] = useState<ThemePresetId>('tokyo-midnight');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const manifest = THEME_PRESETS[preset];
  const theme = useMemo(() => resolveTheme(manifest), [manifest]);
  const sample = SAMPLE_CREWS[preset];
  const page = manifest.pages[0]!;
  const data = useMemo(() => sampleWidgetData(page, sample.members), [page, sample.members]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Theme presets" className="scrollbar-none flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
          {THEME_PRESET_IDS.map((id) => {
            const p = THEME_PRESETS[id];
            const active = id === preset;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setPreset(id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition',
                  active ? 'bg-elevated text-fg shadow-card' : 'text-muted hover:text-fg',
                )}
              >
                <span className="flex -space-x-1" aria-hidden="true">
                  {[p.colors.background, p.colors.primary, p.colors.accent].map((c, i) => (
                    <span key={i} className="size-3 rounded-full ring-1 ring-black/30" style={{ background: c }} />
                  ))}
                </span>
                {p.meta.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1" role="group" aria-label="Preview device">
          {(['desktop', 'mobile'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDevice(d)}
              aria-pressed={device === d}
              className={cn('rounded-md p-1.5 transition', device === d ? 'bg-elevated text-fg' : 'text-muted hover:text-fg')}
            >
              {d === 'desktop' ? <Monitor className="size-4" aria-label="Desktop" /> : <Smartphone className="size-4" aria-label="Mobile" />}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('mx-auto w-full transition-[max-width] duration-300', device === 'mobile' ? 'max-w-[400px]' : 'max-w-none')}>
        <div className="overflow-hidden rounded-2xl border border-line-strong bg-sunken shadow-[0_40px_120px_-40px_rgb(0_0_0/0.8)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
              <span className="size-2.5 rounded-full bg-line-strong" />
            </span>
            <span className="mx-auto truncate rounded-md bg-surface px-3 py-1 font-mono text-[11px] text-subtle">vogn.no/c/{sample.name.toLowerCase().replace(/[^a-z]+/g, '-')}</span>
            <span className="text-[10px] font-semibold tracking-wider text-subtle uppercase">Sample</span>
          </div>
          <div inert className="max-h-[640px] overflow-hidden">
            <CrewThemeScope manifest={manifest} resolved={theme}>
              {manifest.layout.desktop.navigation === 'top' && device === 'desktop' && (
                <nav className="flex items-center gap-6 border-b border-[var(--ct-border)] px-8 py-3 text-sm">
                  {manifest.navigation.map((n) => (
                    <span key={n.id} className="text-[var(--ct-muted)] first:text-[var(--ct-text)]">
                      {n.label}
                    </span>
                  ))}
                </nav>
              )}
              <div className={cn('flex', manifest.layout.desktop.navigation === 'sidebar-right' && 'flex-row-reverse')}>
                {manifest.layout.desktop.navigation !== 'top' && device === 'desktop' && (
                  <aside className="hidden w-52 shrink-0 border-[var(--ct-border)] p-4 md:block" style={{ borderInlineEndWidth: manifest.layout.desktop.navigation === 'sidebar-left' ? 1 : 0, borderInlineStartWidth: manifest.layout.desktop.navigation === 'sidebar-right' ? 1 : 0 }}>
                    <p className="ct-heading mb-3 text-sm">{sample.name}</p>
                    <div className="grid gap-0.5 text-sm">
                      {manifest.navigation.map((n, i) => (
                        <span key={n.id} className={cn('flex items-center gap-2 rounded-[var(--ct-radius-sm)] px-2 py-1.5', i === 0 ? 'bg-[var(--ct-surface-2)]' : 'text-[var(--ct-muted)]')}>
                          <ThemeIcon name={n.icon} className="size-4" />
                          {n.label}
                        </span>
                      ))}
                      <p className="mt-4 mb-1 px-2 text-[10px] font-semibold tracking-widest text-[var(--ct-muted)] uppercase">Channels</p>
                      {['general', 'builds', 'meets', 'tech-talk'].map((c) => (
                        <span key={c} className="flex items-center gap-2 px-2 py-1 text-[var(--ct-muted)]">
                          <ThemeIcon name="hash" className="size-3.5" /> {c}
                        </span>
                      ))}
                    </div>
                  </aside>
                )}
                <div className="min-w-0 flex-1">
                  <CrewHeader
                    theme={theme}
                    compact={device === 'mobile'}
                    online={Math.round(sample.members * 0.08)}
                    crew={{ name: sample.name, description: sample.description, icon: null, banner: null, memberCount: sample.members, region: sample.region, country: sample.country, categoryLabel: sample.category }}
                    actions={<span className="ct-button">Join crew</span>}
                  />
                  <PageRenderer
                    page={page}
                    manifest={manifest}
                    ctx={{
                      crewId: null,
                      crewSlug: 'sample',
                      crewName: sample.name,
                      crewRules: ['Respect everyone.', 'No street racing.', 'Share builds, not plates.'],
                      foundedAt: null,
                      isMember: false,
                      data,
                      mode: 'preview',
                      locale: 'en',
                      joinAction: <span className="ct-button w-fit">Join crew</span>,
                    }}
                  />
                </div>
              </div>
            </CrewThemeScope>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>{manifest.meta.description}</p>
        <Link href="/studio/playground" className="inline-flex items-center gap-1.5 font-medium text-accent-text hover:underline">
          Open the Studio playground <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
