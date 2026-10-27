import '@/server/clerk-defaults';
import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { publicConfig } from '@/lib/config';

const appearance = {
  variables: {
    colorPrimary: '#F2F3F5',
    colorPrimaryForeground: '#090A0C',
    colorBackground: '#121418',
    colorForeground: '#F5F5F6',
    colorMutedForeground: '#A4A8B2',
    colorInput: '#090A0C',
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
 * and shows a configuration screen unless explicit password-gated private testing mode is enabled.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!publicConfig.clerkConfigured) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
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
