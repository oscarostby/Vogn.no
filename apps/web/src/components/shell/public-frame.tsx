import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { AuthButtons } from '@/components/marketing/auth-buttons';

/** Frame for shareable pages (profiles, builds, public crews) viewed while signed out. */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--vogn-bg)_90%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-4 px-4 md:px-6">
          <Link href="/" aria-label="VOGN home">
            <Logo variant="lockup" height={18} />
          </Link>
          <Link href="/discover" className="hidden text-sm text-muted hover:text-fg sm:inline">
            Discover
          </Link>
          <div className="ml-auto">
            <AuthButtons />
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
