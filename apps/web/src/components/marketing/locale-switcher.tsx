'use client';

import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from '@vogn/i18n';
import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { LOCALE_COOKIE } from '@/lib/config';
import { cn } from '@/lib/cn';

export function setLocaleCookie(locale: SupportedLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('common');
  const [pending, start] = useTransition();
  return (
    <label className={cn('relative inline-flex items-center gap-1.5 text-sm text-muted', pending && 'opacity-60', className)}>
      <Globe className="size-4" aria-hidden="true" />
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        onChange={(e) => {
          setLocaleCookie(e.target.value as SupportedLocale);
          start(() => router.refresh());
        }}
        className="cursor-pointer appearance-none bg-transparent pr-1 text-sm text-muted outline-none hover:text-fg"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l} className="bg-surface text-fg">
            {LOCALE_LABELS[l].native}
          </option>
        ))}
      </select>
    </label>
  );
}
