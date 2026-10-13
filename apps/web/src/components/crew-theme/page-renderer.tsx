'use client';

import type { ThemeManifest, ThemePage, ThemeSection, ThemeWidget } from '@vogn/theme-engine';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { WidgetBody, type WidgetRenderContext } from './widgets';

const CONTENT_WIDTH: Record<ThemeManifest['layout']['desktop']['contentWidth'], string> = {
  narrow: 'max-w-3xl',
  normal: 'max-w-6xl',
  wide: 'max-w-[1320px]',
  full: 'max-w-none',
};

const SECTION_BG: Record<ThemeSection['background'], string> = {
  none: '',
  surface: 'bg-[var(--ct-surface)]',
  elevated: 'bg-[var(--ct-surface-2)]',
  accent: 'bg-[color-mix(in_srgb,var(--ct-primary)_12%,var(--ct-bg))]',
  inverted: 'bg-[var(--ct-text)] text-[var(--ct-bg)] [--ct-muted:color-mix(in_srgb,var(--ct-bg)_70%,var(--ct-text))]',
};

const GAP = { sm: '0.6', md: '1', lg: '1.6' } as const;

export interface EditorBindings {
  selectedWidgetId: string | null;
  selectedSectionId: string | null;
  onSelectWidget: (sectionId: string, widgetId: string) => void;
  onSelectSection: (sectionId: string) => void;
  renderSectionToolbar?: (section: ThemeSection) => ReactNode;
}

function WidgetFrame({ widget, children, editor, sectionId }: { widget: ThemeWidget; children: ReactNode; editor?: EditorBindings; sectionId: string }) {
  const variant = widget.style.variant;
  const framed = variant !== 'transparent' && widget.type !== 'spacer' && widget.type !== 'welcome';
  const selected = editor?.selectedWidgetId === widget.id;
  const style: CSSProperties = {
    ['--span-d' as string]: widget.span.desktop,
    ['--span-t' as string]: widget.span.tablet,
    ['--span-m' as string]: widget.span.mobile === 'full' ? 2 : 1,
    ['--row-span' as string]: widget.rowSpan,
    ...(widget.style.accent ? { ['--ct-primary' as string]: widget.style.accent, ['--ct-primary-text' as string]: widget.style.accent } : {}),
  };
  const content = (
    <>
      {widget.title && <h3 className="ct-heading mb-3 text-[calc(1.05rem*var(--ct-type-scale))]">{widget.title}</h3>}
      {children}
    </>
  );
  return (
    <section
      aria-label={widget.title ?? widget.type.replace(/_/g, ' ')}
      style={style}
      className={cn(
        'ct-cell relative',
        widget.hiddenOn.mobile && 'ct-hide-mobile',
        widget.hiddenOn.desktop && 'ct-hide-desktop',
        framed && 'ct-card p-[calc(1.1rem*var(--ct-density))]',
        framed && variant === 'accent' && 'border-[var(--ct-primary)] bg-[color-mix(in_srgb,var(--ct-primary)_10%,var(--ct-surface))]',
        framed && variant === 'outlined' && 'bg-transparent shadow-none',
        framed && variant === 'inverted' && 'bg-[var(--ct-text)] text-[var(--ct-bg)]',
        editor && 'cursor-pointer outline-offset-4 transition-[outline-color]',
        editor && (selected ? 'outline-2 outline-[var(--ct-focus)] outline-solid' : 'outline-1 outline-transparent outline-dashed hover:outline-[var(--ct-border)]'),
      )}
      onClick={
        editor
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              editor.onSelectWidget(sectionId, widget.id);
            }
          : undefined
      }
    >
      {editor ? <div className="pointer-events-none">{content}</div> : content}
    </section>
  );
}

export function SectionRenderer({
  section,
  ctx,
  contentWidth,
  editor,
}: {
  section: ThemeSection;
  ctx: WidgetRenderContext;
  contentWidth: ThemeManifest['layout']['desktop']['contentWidth'];
  editor?: EditorBindings;
}) {
  const selected = editor?.selectedSectionId === section.id && !editor.selectedWidgetId;
  return (
    <div
      className={cn(
        SECTION_BG[section.background],
        `ct-section-pad-${section.padding}`,
        editor && 'relative',
        editor && selected && 'outline-2 -outline-offset-2 outline-[var(--ct-focus)] outline-dashed',
      )}
      onClick={editor ? () => editor.onSelectSection(section.id) : undefined}
    >
      {editor?.renderSectionToolbar?.(section)}
      <div className={cn('mx-auto grid gap-4 px-4 md:px-8', !section.fullBleed && CONTENT_WIDTH[contentWidth])}>
        {(section.title || section.subtitle) && (
          <div className="grid gap-1">
            {section.title && <h2 className="ct-heading text-[calc(1.5rem*var(--ct-type-scale))]">{section.title}</h2>}
            {section.subtitle && <p className="text-sm text-[var(--ct-muted)]">{section.subtitle}</p>}
          </div>
        )}
        <div className="ct-grid" style={{ ['--ct-gap' as string]: `calc(${GAP[section.gap]}rem * var(--ct-density, 1))` }}>
          {section.widgets.map((widget) => (
            <WidgetFrame key={widget.id} widget={widget} editor={editor} sectionId={section.id}>
              <WidgetBody widget={widget} ctx={ctx} />
            </WidgetFrame>
          ))}
          {editor && section.widgets.length === 0 && (
            <div className="ct-cell rounded-[var(--ct-radius)] border border-dashed border-[var(--ct-border)] p-8 text-center text-sm text-[var(--ct-muted)]" style={{ ['--span-d' as string]: 12, ['--span-t' as string]: 12 }}>
              Empty section — add a widget from the panel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageRenderer({
  page,
  manifest,
  ctx,
  editor,
  className,
}: {
  page: ThemePage;
  manifest: ThemeManifest;
  ctx: WidgetRenderContext;
  editor?: EditorBindings;
  className?: string;
}) {
  return (
    <div className={cn('ct-page grid', className)}>
      {page.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} ctx={ctx} contentWidth={manifest.layout.desktop.contentWidth} editor={editor} />
      ))}
    </div>
  );
}
