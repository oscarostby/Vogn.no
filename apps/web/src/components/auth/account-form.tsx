'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SocialSignIn } from './social-sign-in';

export function AccountForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const register = mode === 'sign-up';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid w-full max-w-sm gap-4 rounded-xl border border-line bg-surface p-6" onSubmit={async (event) => {
      event.preventDefault();
      setError(null);
      const form = new FormData(event.currentTarget);
      if (register && form.get('password') !== form.get('confirmPassword')) {
        setError('The passwords do not match.');
        return;
      }
      setBusy(true);
      try {
        const result = await fetch(register ? '/api/auth/register' : '/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginName: form.get('loginName'), password: form.get('password') }),
        });
        const payload = await result.json() as { data?: { next: string }; error?: { message: string; details?: { fieldErrors?: Record<string, string> } } };
        if (!result.ok || !payload.data) {
          throw new Error(payload.error?.details?.fieldErrors?.password ?? payload.error?.message ?? 'Could not continue. Please try again.');
        }
        const requested = new URLSearchParams(window.location.search).get('redirect_url');
        const destination = payload.data.next === '/onboarding' ? '/onboarding' : requested && /^\/(?!\/)/.test(requested) && !requested.includes('\\') ? requested : '/home';
        // A fresh document clears cached profile data when switching between accounts.
        window.location.replace(destination);
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not continue. Please try again.');
        setBusy(false);
      }
    }}>
      <SocialSignIn />
      <div className="flex items-center gap-3 text-xs text-subtle"><span className="h-px flex-1 bg-line" />or use your login name<span className="h-px flex-1 bg-line" /></div>
      <label className="grid gap-1.5 text-sm font-medium">
        Login name
        <Input name="loginName" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" placeholder="Your login name" disabled={busy} />
      </label>
      {register && <p className="-mt-2 text-xs text-muted">3–24 letters, numbers, underscores or dots. Use this name to sign in again.</p>}
      <label className="grid gap-1.5 text-sm font-medium">
        Password
        <Input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={128} disabled={busy} aria-describedby={register ? 'password-help' : undefined} />
      </label>
      {register && <>
        <p id="password-help" className="-mt-2 text-xs text-muted">Choose your own password with at least 12 characters.</p>
        <label className="grid gap-1.5 text-sm font-medium">
          Confirm password
          <Input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} />
        </label>
      </>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? (register ? 'Creating account…' : 'Signing in…') : (register ? 'Create account' : 'Sign in')}</Button>
      <p className="text-center text-sm text-muted">
        {register ? 'Already have an account?' : 'New to VOGN?'}{' '}
        <Link className="font-medium text-accent hover:underline" href={register ? '/sign-in' : '/sign-up'}>
          {register ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </form>
  );
}
