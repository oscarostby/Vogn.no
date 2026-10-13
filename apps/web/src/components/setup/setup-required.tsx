import { Settings2 } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand/logo';
import { getEnv, integrationStatus } from '@/server/env';

/**
 * Shown instead of auth/app screens when required integrations are missing. In production only the
 * integration names are shown — never values.
 */
export async function SetupRequired({ focus }: { focus?: string }) {
  const t = await getTranslations('setup');
  const status = integrationStatus();
  const missing = status.filter((s) => !s.configured && (s.required || s.name === focus));
  const showVars = getEnv().NODE_ENV !== 'production';
  return (
    <div data-theme="dark" className="flex min-h-dvh items-center justify-center bg-bg px-5 py-16 text-fg">
      <div className="grid w-full max-w-lg gap-6 rounded-2xl border border-line bg-surface p-8">
        <Logo variant="lockup" height={20} forceDark />
        <div className="grid gap-2">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Settings2 className="size-5 text-warning" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="text-sm text-muted">{t('body')}</p>
        </div>
        <ul className="grid gap-2">
          {missing.map((m) => (
            <li key={m.name} className="rounded-lg border border-line bg-sunken p-3">
              <p className="text-sm font-semibold">{m.name}</p>
              {showVars && <p className="mt-1 font-mono text-xs text-muted">{m.missing.join(', ')}</p>}
            </li>
          ))}
        </ul>
        <p className="text-xs text-subtle">{t('docs')}</p>
        <Link href="/" className="text-sm font-medium text-accent-text hover:underline">
          ← vogn.no
        </Link>
      </div>
    </div>
  );
}
