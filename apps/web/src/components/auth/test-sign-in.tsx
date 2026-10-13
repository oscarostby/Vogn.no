'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TestSignIn() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid w-full max-w-sm gap-4 rounded-xl border border-line bg-surface p-6" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      const form = new FormData(event.currentTarget);
      try {
        const result = await fetch('/api/test-auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginName: form.get('loginName'), password: form.get('password') }),
        });
        const payload = await result.json() as { data?: { next: string }; error?: { message: string } };
        if (!result.ok || !payload.data) throw new Error(payload.error?.message ?? 'Could not sign in.');
        const requested = new URLSearchParams(window.location.search).get('redirect_url');
        const destination = payload.data.next === '/onboarding' ? '/onboarding' : requested && /^\/(?!\/)/.test(requested) && !requested.includes('\\') ? requested : '/home';
        router.replace(destination);
        router.refresh();
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could not sign in.');
      } finally {
        setBusy(false);
      }
    }}>
      <label className="grid gap-1.5 text-sm font-medium">
        Test login name
        <Input name="loginName" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" placeholder="oscar" disabled={busy} />
      </label>
      <p className="-mt-2 text-xs text-muted">Use the same login name each time to return to your account. Your public profile name can be changed separately.</p>
      <label className="grid gap-1.5 text-sm font-medium">
        Private test password
        <Input name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={busy} />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</Button>
      <p className="text-xs leading-relaxed text-muted">This private environment uses a shared test password. Anyone with that password can open a test login name. Use it only with trusted testers.</p>
    </form>
  );
}
