'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/cn';
import { AuthButtons } from './auth-buttons';
import { LocaleSwitcher } from './locale-switcher';

const LINKS = [
  { href: '/#studio', label: 'Crew Studio' },
  { href: '/#garage', label: 'Garage' },
  { href: '/#chat', label: 'Chat' },
  { href: '/#safety', label: 'Safety' },
  { href: '/discover', label: 'Discover' },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200',
        scrolled ? 'border-line bg-[color-mix(in_srgb,var(--vogn-bg)_88%,transparent)] backdrop-blur-md' : 'border-transparent',
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-5 md:px-8">
        <Link href="/" className="shrink-0" aria-label="VOGN home">
          <Logo variant="lockup" height={22} forceDark priority />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm text-muted transition hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
