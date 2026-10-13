// Deterministic, non-secret values for the test environment only.
Object.assign(process.env, {
  APP_SIGNING_SECRET: 'test-signing-secret-0123456789abcdef0123456789',
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
});
