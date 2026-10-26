// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialSignIn } from './social-sign-in';

const mocks = vi.hoisted(() => ({ sso: vi.fn(), push: vi.fn(), fetch: vi.fn(), config: { clerkConfigured: true, privateTestAuth: true } }));
vi.mock('@clerk/nextjs', () => ({ useSignIn: () => ({ signIn: { sso: mocks.sso } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/config', () => ({ publicConfig: mocks.config }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.clerkConfigured = true;
  mocks.fetch.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('social sign-in controls', () => {
  it.each([['Google', 'oauth_google'], ['Apple', 'oauth_apple']])('starts %s sign-in and clears the previous local identity first', async (name, strategy) => {
    mocks.sso.mockResolvedValue({ error: null });
    render(<SocialSignIn />);
    fireEvent.click(screen.getByRole('button', { name: `Continue with ${name}` }));
    await waitFor(() => expect(mocks.sso).toHaveBeenCalledWith({ strategy, redirectUrl: '/home', redirectCallbackUrl: '/sso-callback' }));
    expect(mocks.fetch).toHaveBeenCalledWith('/api/auth/session', { method: 'DELETE' });
    expect(mocks.fetch.mock.invocationCallOrder[0]).toBeLessThan(mocks.sso.mock.invocationCallOrder[0]!);
    expect(mocks.push).toHaveBeenCalledWith('/social-sign-in');
  });

  it('shows provider errors and allows the user to try again', async () => {
    mocks.sso.mockResolvedValue({ error: { message: 'Provider unavailable' } });
    render(<SocialSignIn />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Provider unavailable'));
    expect((screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not start an unconfigured provider', () => {
    mocks.config.clerkConfigured = false;
    render(<SocialSignIn />);
    expect((screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Continue with Apple' }) as HTMLButtonElement).disabled).toBe(true);
    expect(mocks.sso).not.toHaveBeenCalled();
  });
});
