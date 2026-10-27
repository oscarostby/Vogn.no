import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="flex min-h-svh flex-col bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
