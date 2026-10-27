import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from './locale-switcher';

export async function SiteFooter() {
  const t = await getTranslations('gateway');
  return (
    <footer className="mx-auto w-full max-w-[1440px] shrink-0 px-5 sm:px-8 lg:px-12">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5 border-t border-line py-6 text-xs text-subtle sm:py-7">
        <span>© VOGN</span>
        <div className="flex flex-wrap items-center gap-5 sm:gap-7">
          <LocaleSwitcher className="text-xs [&_select]:text-xs [&_svg]:size-3.5" />
          <Link className="transition-colors hover:text-fg" href="/legal/privacy">{t('privacy')}</Link>
          <Link className="transition-colors hover:text-fg" href="/legal/terms">{t('terms')}</Link>
        </div>
      </div>
    </footer>
  );
}
