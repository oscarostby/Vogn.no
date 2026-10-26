import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { PUBLIC_DEFAULTS } from './src/config/public-defaults';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : isDev ? 'http://localhost:3000' : PUBLIC_DEFAULTS.appUrl);
const clerkEnabled = process.env.NEXT_PUBLIC_CLERK_ENABLED !== 'false';
const clerkPublishableKey = clerkEnabled ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || PUBLIC_DEFAULTS.clerkPublishableKey : '';
// This flag is public. Database credentials and signing/encryption keys stay in server-only modules.
const privateTestFlag = process.env.NEXT_PUBLIC_TEST_AUTH_ENABLED || process.env.TEST_AUTH_ENABLED || 'true';

/**
 * Content Security Policy. Clerk, Ably, Cloudinary, R2 and LiveKit are the only third parties the browser
 * talks to. Inline styles are required by theme CSS variables and Next.js; scripts are restricted to self
 * plus Clerk's frontend API.
 */
const clerkFrontendApi = 'https://*.clerk.accounts.dev https://clerk.vogn.no https://*.clerk.com';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} ${clerkFrontendApi} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://img.clerk.com https://images.clerk.dev",
  "media-src 'self' blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  `connect-src 'self' ${clerkFrontendApi} https://api.cloudinary.com https://*.r2.cloudflarestorage.com wss://*.ably.io https://*.ably.io https://*.ably-realtime.com wss://*.ably-realtime.com https://*.ably.net wss://*.ably.net wss://*.livekit.cloud https://*.livekit.cloud`,
  `frame-src ${clerkFrontendApi} https://challenges.cloudflare.com https://www.youtube-nocookie.com https://player.vimeo.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isDev ? '' : 'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp.replace(/\s{2,}/g, ' ') },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_URL: appUrl, NEXT_PUBLIC_TEST_AUTH_ENABLED: privateTestFlag, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey, NEXT_PUBLIC_CLERK_ENABLED: String(clerkEnabled) },
  transpilePackages: [
    '@vogn/api-client',
    '@vogn/database',
    '@vogn/i18n',
    '@vogn/permissions',
    '@vogn/theme-engine',
    '@vogn/types',
    '@vogn/ui-tokens',
    '@vogn/utils',
    '@vogn/validation',
  ],
  serverExternalPackages: ['mongodb', 'cloudinary', 'livekit-server-sdk'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
