'use client';

import { useSignIn } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { publicConfig } from '@/lib/config';

export function SocialSignIn() {
  if (publicConfig.clerkConfigured) return <ConnectedSocialSignIn />;
  return <div className="grid gap-2">
    <Button type="button" variant="outline" disabled>Continue with Google</Button>
    <Button type="button" variant="outline" disabled>Continue with Apple</Button>
    <p className="text-center text-xs text-muted">Google and Apple sign-in are not available yet. Use your login name and password below.</p>
  </div>;
}

function ConnectedSocialSignIn() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(strategy: 'oauth_google' | 'oauth_apple') {
    setBusy(strategy);
    setError(null);
    try {
      if (publicConfig.privateTestAuth) {
        const response = await fetch('/api/auth/session', { method: 'DELETE' });
        if (!response.ok) throw new Error('Could not start social sign-in. Please try again.');
      }
      const result = await signIn.sso({ strategy, redirectUrl: '/home', redirectCallbackUrl: '/sso-callback' });
      if (result.error) throw new Error(result.error.message ?? 'Could not connect. Please try again.');
      // Clerk's prebuilt flow handles extra requirements, such as MFA or a sign-up challenge.
      router.push('/social-sign-in');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not connect. Please try again.');
      setBusy(null);
    }
  }
  return <div className="grid gap-2">
    <Button type="button" variant="outline" disabled={Boolean(busy)} loading={busy === 'oauth_google'} onClick={() => void start('oauth_google')}>Continue with Google</Button>
    <Button type="button" variant="outline" disabled={Boolean(busy)} loading={busy === 'oauth_apple'} onClick={() => void start('oauth_apple')}>Continue with Apple</Button>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div id="clerk-captcha" />
  </div>;
}
