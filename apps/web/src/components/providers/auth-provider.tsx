import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { publicConfig } from '@/lib/config';

const appearance = {
  variables: {
    colorPrimary: '#C8FF5F',
    colorPrimaryForeground: '#101114',
    colorBackground: '#191B20',
    colorForeground: '#F5F5F6',
    colorMutedForeground: '#A4A8B2',
    colorInput: '#101114',
    colorInputForeground: '#F5F5F6',
    colorNeutral: '#F5F5F6',
    colorDanger: '#FF6B6B',
    borderRadius: '10px',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
  },
  layout: {
    logoImageUrl: '/brand/vogn-logo-white.webp',
    socialButtonsVariant: 'blockButton',
    termsPageUrl: '/legal/terms',
    privacyPageUrl: '/legal/privacy',
  },
};

/**
 * Wraps the tree in ClerkProvider only when Clerk is configured. Without keys the app renders public pages
 * and shows a configuration screen for protected areas (see proxy.ts) — it never runs in a keyless mode.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!publicConfig.clerkConfigured) return <>{children}</>;
  return (
    <ClerkProvider
      appearance={appearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/home"
      signUpFallbackRedirectUrl="/onboarding"
    >
      {children}
    </ClerkProvider>
  );
}
