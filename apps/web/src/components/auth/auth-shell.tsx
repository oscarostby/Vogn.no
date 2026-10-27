import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const t = await getTranslations('gateway');
  return (
    <div data-theme="dark" className="flex min-h-svh flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-12 sm:py-16">
        <Link href="/" aria-label="VOGN" className="mb-2"><Logo variant="mark" height={25} forceDark /></Link>
        <div className="grid max-w-sm gap-2 text-center">
          <h1 className="font-display text-2xl font-medium tracking-tight">{title}</h1>
          <p className="text-sm leading-relaxed text-muted">{subtitle}</p>
        </div>
        {children}
        <p className="max-w-sm text-center text-xs leading-relaxed text-subtle">
          {t('agreement')}{' '}
          <Link className="underline underline-offset-4 hover:text-fg" href="/legal/terms">{t('terms')}</Link>
          {' · '}
          <Link className="underline underline-offset-4 hover:text-fg" href="/legal/privacy">{t('privacy')}</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
