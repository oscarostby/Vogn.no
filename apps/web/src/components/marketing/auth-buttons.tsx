'use client';

import { Show } from '@clerk/nextjs';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { publicConfig } from '@/lib/config';

export function AuthButtons({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  const t = useTranslations('common');
  const signedOut = (
    <>
      <Button asChild variant="ghost" size={size}>
        <Link href="/sign-in">{t('signIn')}</Link>
      </Button>
      <Button asChild size={size}>
        <Link href="/sign-up">{t('signUp')}</Link>
      </Button>
    </>
  );
  if (!publicConfig.clerkConfigured) return <div className="flex items-center gap-1.5">{signedOut}</div>;
  return (
    <div className="flex items-center gap-1.5">
      <Show when="signed-in">
        <Button asChild size={size}>
          <Link href="/home">
            {t('openApp')} <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </Show>
      <Show when="signed-out">{signedOut}</Show>
    </div>
  );
}

export function PrimaryCta({ label, size = 'lg' }: { label: string; size?: 'md' | 'lg' }) {
  const t = useTranslations('common');
  if (!publicConfig.clerkConfigured) {
    return (
      <Button asChild size={size}>
        <Link href="/sign-up">
          {label} <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    );
  }
  return (
    <>
      <Show when="signed-out">
        <Button asChild size={size}>
          <Link href="/sign-up">
            {label} <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </Show>
      <Show when="signed-in">
        <Button asChild size={size}>
          <Link href="/home">
            {t('openApp')} <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </Show>
    </>
  );
}
