import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const t = await getTranslations('gateway');
  const common = await getTranslations('common');

  return (
    <section aria-labelledby="gateway-title" className="flex flex-1 items-center justify-center px-5 py-20 sm:py-24">
      <div className="flex w-full max-w-xl flex-col items-center text-center sm:-translate-y-4">
        <Logo variant="mark" height={42} forceDark priority />
        <h1 id="gateway-title" className="mt-7 font-display text-[52px] leading-none font-medium tracking-[0.12em] text-fg sm:text-[68px]">
          VOGN<span className="text-muted">.</span>
        </h1>
        <p className="mt-6 text-lg font-normal tracking-[-0.02em] text-muted sm:text-xl">{t('tagline')}</p>
        <div className="mt-12 grid w-full max-w-[400px] grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:mt-14 sm:gap-4">
          <Button asChild size="lg" className="w-full gap-5 rounded-lg">
            <Link href="/sign-in">{common('signIn')} <ArrowRight className="size-4!" aria-hidden="true" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full rounded-lg border-line-strong bg-surface/30">
            <Link href="/sign-up">{common('signUp')}</Link>
          </Button>
        </div>
        <p className="mt-8 max-w-xs text-sm leading-relaxed text-subtle sm:mt-9 sm:max-w-none">{t('welcomeBack')}</p>
      </div>
    </section>
  );
}
