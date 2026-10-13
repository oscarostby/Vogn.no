import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from './locale-switcher';

export async function SiteFooter() {
  const t = await getTranslations('landing');
  const c = await getTranslations('common');
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div className="grid content-start gap-4">
          <Logo variant="lockup" height={20} forceDark />
          <p className="max-w-xs text-sm text-muted">{c('tagline')}</p>
          <LocaleSwitcher />
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-subtle uppercase">Product</p>
          <Link className="text-muted hover:text-fg" href="/discover">Discover crews</Link>
          <Link className="text-muted hover:text-fg" href="/studio/playground">Try Crew Studio</Link>
          <Link className="text-muted hover:text-fg" href="/#garage">Digital garage</Link>
          <Link className="text-muted hover:text-fg" href="/#safety">Verification</Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-subtle uppercase">Legal</p>
          <Link className="text-muted hover:text-fg" href="/legal/privacy">{t('footerPrivacy')}</Link>
          <Link className="text-muted hover:text-fg" href="/legal/terms">{t('footerTerms')}</Link>
          <Link className="text-muted hover:text-fg" href="/legal/guidelines">{t('footerGuidelines')}</Link>
        </div>
        <div className="grid content-start gap-2 text-sm">
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-subtle uppercase">VOGN</p>
          <a className="text-muted hover:text-fg" href="mailto:hello@vogn.no">{t('footerContact')}</a>
          <a className="text-muted hover:text-fg" href="mailto:security@vogn.no">Security</a>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1240px] px-5 py-6 text-xs text-subtle md:px-8">© {new Date().getFullYear()} VOGN · vogn.no</p>
      </div>
    </footer>
  );
}
