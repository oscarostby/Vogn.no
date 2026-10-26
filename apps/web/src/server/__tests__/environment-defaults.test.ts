import { describe, expect, it } from 'vitest';
import { environmentInput } from '@/server/env';
import { applyClerkRuntimeDefaults } from '@/server/clerk-defaults';

describe('committed private deployment defaults', () => {
  it('starts private testing without external environment configuration', () => {
    const input = environmentInput({ NODE_ENV: 'production' });
    expect(input.TEST_AUTH_ENABLED).toBe('true');
    expect(input.NEXT_PUBLIC_TEST_AUTH_ENABLED).toBe('true');
    expect(input.TEST_MEDIA_ENABLED).toBe('true');
    expect(typeof input.MONGODB_URI).toBe('string');
    expect(Buffer.from(input.DATA_ENCRYPTION_KEY!, 'base64')).toHaveLength(32);
    expect(input.APP_SIGNING_SECRET!.length).toBeGreaterThanOrEqual(32);
    expect(input.TEST_AUTH_PASSWORD!.length).toBeGreaterThanOrEqual(16);
    expect(input.CLERK_SECRET_KEY).toMatch(/^sk_/);
    expect(input.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toMatch(/^pk_/);
  });
  it('allows explicit environment overrides, including disabling test mode', () => {
    const input = environmentInput({ NODE_ENV: 'production', TEST_AUTH_ENABLED: 'false', NEXT_PUBLIC_TEST_AUTH_ENABLED: 'false', MONGODB_URI: 'mongodb://localhost/isolated' });
    expect(input.TEST_AUTH_ENABLED).toBe('false');
    expect(input.NEXT_PUBLIC_TEST_AUTH_ENABLED).toBe('false');
    expect(input.MONGODB_URI).toBe('mongodb://localhost/isolated');
  });
  it('never injects committed database access or credentials into isolated tests', () => {
    const input = environmentInput({ NODE_ENV: 'test', APP_SIGNING_SECRET: 'isolated-test-signing-key' });
    expect(input.MONGODB_URI).toBeUndefined();
    expect(input.TEST_AUTH_PASSWORD).toBeUndefined();
    expect(input.TEST_AUTH_ENABLED).toBeUndefined();
    expect(input.VEGVESEN_API_KEY).toBeUndefined();
    expect(input.CLERK_SECRET_KEY).toBeUndefined();
    expect(input.APP_SIGNING_SECRET).toBe('isolated-test-signing-key');
  });
  it('uses the hosted origin without requiring a dotenv file and follows Vercel deployment domains', () => {
    expect(environmentInput({ NODE_ENV: 'production' }).NEXT_PUBLIC_APP_URL).toBe('https://vognno.vercel.app');
    expect(environmentInput({ NODE_ENV: 'production', VERCEL_URL: 'preview.example.vercel.app' }).NEXT_PUBLIC_APP_URL).toBe('https://preview.example.vercel.app');
    expect(environmentInput({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://custom.example' }).NEXT_PUBLIC_APP_URL).toBe('https://custom.example');
  });
  it('initializes the server SDK from committed values while preserving explicit overrides', () => {
    const raw: Record<string, string | undefined> = { NODE_ENV: 'production' };
    applyClerkRuntimeDefaults(raw);
    expect(raw.CLERK_SECRET_KEY).toMatch(/^sk_/);
    expect(raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toMatch(/^pk_/);
    const override = { NODE_ENV: 'production', CLERK_SECRET_KEY: 'sk_live_override', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_override' };
    applyClerkRuntimeDefaults(override);
    expect(override.CLERK_SECRET_KEY).toBe('sk_live_override');
    expect(override.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe('pk_live_override');
  });
  it('does not initialize Clerk from real defaults in isolated tests or when explicitly disabled', () => {
    for (const raw of [{ NODE_ENV: 'test' }, { NODE_ENV: 'production', NEXT_PUBLIC_CLERK_ENABLED: 'false' }] as Record<string, string | undefined>[]) {
      applyClerkRuntimeDefaults(raw);
      expect(raw.CLERK_SECRET_KEY).toBeUndefined();
    }
    expect(environmentInput({ NODE_ENV: 'production', NEXT_PUBLIC_CLERK_ENABLED: 'false' }).CLERK_SECRET_KEY).toBeUndefined();
  });
});
