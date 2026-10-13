import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';

/** Split layout for sign-in / sign-up: brand panel + Clerk component. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div data-theme="dark" className="grid min-h-dvh bg-bg text-fg lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'radial-gradient(70% 60% at 30% 20%, color-mix(in srgb, var(--vogn-accent) 12%, transparent), transparent 70%)' }}
        />
        <div aria-hidden="true" className="absolute -bottom-24 -left-24 h-[460px] w-[640px] rotate-[-28deg] opacity-[0.08]">
          <div className="absolute inset-y-0 left-0 w-24 bg-accent" />
          <div className="absolute inset-y-0 left-36 w-10 bg-accent" />
          <div className="absolute inset-y-0 left-56 w-24 bg-fg" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" aria-label="VOGN home">
            <Logo variant="lockup" height={24} forceDark priority />
          </Link>
          <div className="grid max-w-md gap-4">
            <p className="font-display text-4xl leading-tight font-semibold tracking-tight">Your crew. Your space.</p>
            <p className="text-muted">Crews, garages and conversations for car people everywhere. Your email and phone number are never shown on your profile.</p>
          </div>
          <p className="text-xs text-subtle">
            By continuing you agree to the{' '}
            <Link className="underline" href="/legal/terms">
              Terms
            </Link>{' '}
            and{' '}
            <Link className="underline" href="/legal/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center gap-6 px-5 py-12">
        <div className="lg:hidden">
          <Logo variant="lockup" height={22} forceDark />
        </div>
        <div className="grid gap-1 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
