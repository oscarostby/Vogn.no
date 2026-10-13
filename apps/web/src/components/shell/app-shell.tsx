'use client';

import { Bell, Menu, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Avatar } from '@/components/ui/display';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { Tooltip, TooltipProvider } from '@/components/ui/menu';
import { cn } from '@/lib/cn';
import { isOnboarding, useMe, useMyCrews, useUnreadCount } from '@/lib/hooks';
import { RealtimeProvider } from '@/lib/realtime/provider';
import { isActive, PRIMARY_NAV, SECONDARY_NAV } from './nav-config';
import { SearchDialog, useSearchShortcut } from './search-dialog';
import { UserMenu } from './user-menu';

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-fg ring-2 ring-sunken">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function RailLink({ href, label, active, children, badge = 0 }: { href: string; label: string; active: boolean; children: ReactNode; badge?: number }) {
  return (
    <Tooltip content={label} side="right">
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex size-11 items-center justify-center rounded-xl transition-colors [&_svg]:size-[20px]',
          active ? 'bg-elevated text-fg' : 'text-subtle hover:bg-elevated hover:text-fg',
        )}
      >
        <span className={cn('absolute -left-[13px] h-5 w-1 rounded-r-full bg-accent transition-transform', active ? 'scale-y-100' : 'scale-y-0')} />
        {children}
        <Badge count={badge} />
      </Link>
    </Tooltip>
  );
}

function CrewRail() {
  const { data: crews } = useMyCrews();
  const pathname = usePathname();
  const t = useTranslations('nav');
  return (
    <div className="scrollbar-none flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
      {crews?.map((crew) => {
        const active = pathname.startsWith(`/c/${crew.slug}`);
        return (
          <Tooltip key={crew.id} content={crew.name} side="right">
            <Link href={`/c/${crew.slug}`} aria-label={crew.name} aria-current={active ? 'page' : undefined} className="group relative">
              <span className={cn('absolute top-1/2 -left-[13px] w-1 -translate-y-1/2 rounded-r-full bg-fg transition-all', active ? 'h-8' : crew.unreadCount ? 'h-2' : 'h-0 group-hover:h-4')} />
              <Avatar
                name={crew.name}
                image={crew.icon}
                size="lg"
                shape={active ? 'rounded' : 'circle'}
                accent={crew.accentColor}
                className="size-11! transition-[border-radius] [&_*]:transition-[border-radius]"
              />
              {crew.mentionCount > 0 && <Badge count={crew.mentionCount} />}
            </Link>
          </Tooltip>
        );
      })}
      <Tooltip content={t('createCrew')} side="right">
        <Link href="/crews/new" aria-label={t('createCrew')} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-subtle transition hover:border-accent-text hover:text-accent-text">
          <Plus className="size-5" aria-hidden="true" />
        </Link>
      </Tooltip>
    </div>
  );
}

function NavRail({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { data: unread } = useUnreadCount();
  return (
    <nav aria-label="Main" className="hidden w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-sunken py-3 md:flex">
      <Link href="/home" aria-label="VOGN home" className="mb-2 flex size-11 items-center justify-center">
        <Logo variant="mark" height={16} />
      </Link>
      <Tooltip content={`${t('discover')} · Ctrl K`} side="right">
        <button type="button" onClick={onSearch} aria-label="Search" className="flex size-11 items-center justify-center rounded-xl text-subtle transition hover:bg-elevated hover:text-fg">
          <Search className="size-5" aria-hidden="true" />
        </button>
      </Tooltip>
      {PRIMARY_NAV.map((item) => (
        <RailLink key={item.href} href={item.href} label={t(item.key)} active={isActive(pathname, item.href)}>
          <item.icon aria-hidden="true" />
        </RailLink>
      ))}
      <div className="my-2 h-px w-8 shrink-0 bg-line" />
      <CrewRail />
      <div className="mt-2 flex flex-col items-center gap-1 border-t border-line pt-2">
        {SECONDARY_NAV.map((item) => (
          <RailLink key={item.href} href={item.href} label={t(item.key)} active={isActive(pathname, item.href)} badge={item.key === 'notifications' ? (unread?.count ?? 0) : 0}>
            <item.icon aria-hidden="true" />
          </RailLink>
        ))}
        <div className="mt-1">
          <UserMenu side="right" />
        </div>
      </div>
    </nav>
  );
}

function MobileBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const { data: unread } = useUnreadCount();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--vogn-bg)_92%,transparent)] px-3 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      <button type="button" onClick={onMenu} aria-label="Open navigation" className="flex size-10 items-center justify-center rounded-lg text-muted">
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <Link href="/home" aria-label="VOGN home">
        <Logo variant="lockup" height={16} />
      </Link>
      <div className="ml-auto flex items-center gap-1">
        <button type="button" onClick={onSearch} aria-label="Search" className="flex size-10 items-center justify-center rounded-lg text-muted">
          <Search className="size-5" aria-hidden="true" />
        </button>
        <Link href="/notifications" aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-lg text-muted">
          <Bell className="size-5" aria-hidden="true" />
          <Badge count={unread?.count ?? 0} />
        </Link>
        <UserMenu side="bottom" />
      </div>
    </header>
  );
}

function BottomTabs() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const items = [PRIMARY_NAV[0], PRIMARY_NAV[2], PRIMARY_NAV[3], PRIMARY_NAV[4], PRIMARY_NAV[5]];
  // Hide tab bar inside chat views to give the composer room.
  if (/^\/(messages\/[^/]+|c\/[^/]+\/ch\/)/.test(pathname)) return null;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-[color-mix(in_srgb,var(--vogn-surface)_96%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex flex-col items-center gap-1 py-2 text-[10px] font-medium', active ? 'text-fg' : 'text-subtle')}>
            <item.icon className={cn('size-5', active && 'text-accent-text')} aria-hidden="true" />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: crews } = useMyCrews();
  const t = useTranslations('nav');
  const pathname = usePathname();
  useEffect(() => onOpenChange(false), [pathname, onOpenChange]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" title="Navigation">
        <div className="flex h-14 items-center border-b border-line px-4">
          <Logo variant="lockup" height={16} />
        </div>
        <div className="grid gap-1 overflow-y-auto p-3">
          {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
            <Link key={item.href} href={item.href} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', isActive(pathname, item.href) ? 'bg-elevated text-fg' : 'text-muted')}>
              <item.icon className="size-5" aria-hidden="true" />
              {t(item.key)}
            </Link>
          ))}
          <p className="mt-4 px-3 text-xs font-semibold tracking-wider text-subtle uppercase">{t('yourCrews')}</p>
          {crews?.map((crew) => (
            <Link key={crew.id} href={`/c/${crew.slug}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-elevated hover:text-fg">
              <Avatar name={crew.name} image={crew.icon} size="sm" shape="rounded" accent={crew.accentColor} />
              <span className="truncate">{crew.name}</span>
              {crew.unreadCount > 0 && <span className="ml-auto size-2 rounded-full bg-fg" />}
            </Link>
          ))}
          <Link href="/crews/new" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-accent-text">
            <Plus className="size-5" aria-hidden="true" /> {t('createCrew')}
          </Link>
        </div>
      </SheetContent>
    </Dialog>
  );
}

/** Authenticated application frame. Redirects to onboarding until a VOGN profile exists. */
export function AppShell({ children }: { children: ReactNode }) {
  const { data: me, isError } = useMe();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useSearchShortcut(openSearch);

  useEffect(() => {
    if (isOnboarding(me)) router.replace('/onboarding');
  }, [me, router]);

  if (isOnboarding(me) || (!me && !isError)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Logo variant="mark" height={22} className="animate-pulse-soft" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <RealtimeProvider userId={me && !isOnboarding(me) ? me.id : null}>
        <div className="flex h-dvh overflow-hidden bg-bg">
          <NavRail onSearch={openSearch} />
          <div className="flex min-w-0 flex-1 flex-col">
            <MobileBar onSearch={openSearch} onMenu={() => setDrawerOpen(true)} />
            <main id="main" className="min-h-0 flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
              {children}
            </main>
          </div>
          <BottomTabs />
        </div>
        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
        <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </RealtimeProvider>
    </TooltipProvider>
  );
}
