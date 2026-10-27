import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { AuthButtons } from './auth-buttons';

export async function SiteHeader() {
  const t = await getTranslations('common');
  return (
    <header className="shrink-0 border-b border-line/70">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-5 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        {t('skipToContent')}
      </a>
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-5 sm:h-20 sm:px-8 lg:px-12">
        <Link href="/" aria-label="VOGN" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-ring">
          <span className="hidden sm:inline-flex"><Logo variant="lockup" height={20} forceDark priority /></span>
          <span className="inline-flex sm:hidden"><Logo variant="mark" height={17} forceDark priority /></span>
        </Link>
        <nav aria-label={t('signIn')}><AuthButtons size="md" registrationVariant="outline" /></nav>
      </div>
    </header>
  );
}
