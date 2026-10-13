import { describe, expect, it } from 'vitest';
import { environmentInput } from '@/server/env';

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
    expect(input.APP_SIGNING_SECRET).toBe('isolated-test-signing-key');
  });
});
