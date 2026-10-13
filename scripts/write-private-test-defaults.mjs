import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Explicitly requested by the owner for this private throwaway testing repository.
// Read locally and write only to the server-only module; never print secret values.
const source = resolve(import.meta.dirname, '../apps/web/.env.local');
const target = resolve(import.meta.dirname, '../apps/web/src/server/private-test-defaults.ts');
const settings = Object.fromEntries(readFileSync(source, 'utf8').split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => { const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1).trim()]; })
  .filter(([key, value]) => value && key !== 'NEXT_PUBLIC_APP_URL' && key !== 'CLERK_AUTHORIZED_PARTIES'));
for (const key of ['MONGODB_URI', 'MONGODB_DB', 'DATA_ENCRYPTION_KEY', 'APP_SIGNING_SECRET', 'TEST_AUTH_PASSWORD', 'CRON_SECRET']) {
  if (!settings[key]) throw new Error(`Missing local test setting: ${key}`);
}
settings.TEST_AUTH_ENABLED = 'true';
settings.NEXT_PUBLIC_TEST_AUTH_ENABLED = 'true';
settings.TEST_MEDIA_ENABLED = 'true';
const body = `import 'server-only';\n\n/** Committed private test settings at the owner's explicit request. Never import in client code. */\nexport const PRIVATE_TEST_DEFAULTS = ${JSON.stringify(settings, null, 2)} as const;\n`;
writeFileSync(target, body);
console.log('Wrote committed server-only test defaults. Secret values were not printed.');
