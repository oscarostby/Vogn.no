import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Providers } from '@/components/providers/providers';
import { MOTION_COOKIE, publicConfig, THEME_COOKIE } from '@/lib/config';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(publicConfig.appUrl),
  title: { default: 'VOGN — Your crew. Your space.', template: '%s · VOGN' },
  description:
    'VOGN is the global community platform for car enthusiasts: customizable crews, digital garages, realtime chat and events.',
  applicationName: 'VOGN',
  openGraph: {
    type: 'website',
    siteName: 'VOGN',
    title: 'VOGN — Your crew. Your space.',
    description: 'Customizable crews, digital garages, realtime chat and events for car people everywhere.',
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'VOGN' }],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#101114' },
    { media: '(prefers-color-scheme: light)', color: '#F7F7F5' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  const motion = cookieStore.get(MOTION_COOKIE)?.value;

  return (
    <html
      lang={locale}
      dir="ltr"
      data-theme={theme === 'light' || theme === 'system' ? theme : 'dark'}
      data-motion={motion === 'reduce' ? 'reduce' : undefined}
      className={fontVariables}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <AuthProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
