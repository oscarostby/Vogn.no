'use client';

import { useClerk } from '@clerk/nextjs';
import { platformCan } from '@vogn/permissions';
import { LogOut, Moon, Settings, Shield, ShieldCheck, Sun, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/display';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { publicConfig, THEME_COOKIE } from '@/lib/config';
import { useProfile } from '@/lib/hooks';

export function setThemePreference(theme: 'dark' | 'light' | 'system') {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  document.documentElement.dataset.theme = theme;
}

export function UserMenu({ side = 'right' }: { side?: 'right' | 'top' | 'bottom' }) {
  return publicConfig.privateTestAuth ? <PrivateTestUserMenu side={side} /> : <ClerkUserMenu side={side} />;
}

function ClerkUserMenu({ side }: { side: 'right' | 'top' | 'bottom' }) {
  const clerk = useClerk();
  return <UserMenuContent side={side} onSignOut={() => clerk.signOut({ redirectUrl: '/' })} />;
}

function PrivateTestUserMenu({ side }: { side: 'right' | 'top' | 'bottom' }) {
  const router = useRouter();
  return <UserMenuContent side={side} onSignOut={async () => {
    try {
      const result = await fetch('/api/test-auth/session', { method: 'DELETE' });
      if (!result.ok) throw new Error('Could not sign out. Please try again.');
      router.replace('/');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sign out.');
    }
  }} />;
}

function UserMenuContent({ side, onSignOut }: { side: 'right' | 'top' | 'bottom'; onSignOut: () => Promise<unknown> }) {
  const me = useProfile();
  const t = useTranslations();
  const router = useRouter();
  if (!me) return <span className="size-9 animate-pulse-soft rounded-full bg-elevated" />;
  const isLight = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-offset-2" aria-label={t('nav.account')}>
        <Avatar name={me.displayName} image={me.avatar} accent={me.accentColor} size="md" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 py-2">
          <span className="truncate text-sm font-semibold text-fg">{me.displayName}</span>
          <span className="truncate text-xs text-muted">@{me.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<User />} asChild>
          <Link href={`/u/${me.username}`}>{t('nav.profile')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem icon={<ShieldCheck />} asChild>
          <Link href="/verification">{t('nav.verification')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Settings />} asChild>
          <Link href="/settings">{t('nav.settings')}</Link>
        </DropdownMenuItem>
        {platformCan(me.platformRole, 'view_admin') && (
          <DropdownMenuItem icon={<Shield />} asChild>
            <Link href="/admin">{t('nav.admin')}</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          icon={isLight ? <Moon /> : <Sun />}
          onSelect={() => {
            setThemePreference(isLight ? 'dark' : 'light');
            router.refresh();
          }}
        >
          {isLight ? t('common.dark') : t('common.light')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut />} destructive onSelect={() => void onSignOut()}>
          {t('common.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
