import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve(import.meta.dirname, '../apps/web/.env.local');
const target = resolve(import.meta.dirname, '../apps/web/.env.vercel.local');
const lines = readFileSync(source, 'utf8').split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line));
// Vercel supplies its own deployment hostname. Localhost would produce incorrect links on hosting.
const output = lines.filter((line) => !/^(NEXT_PUBLIC_APP_URL|CLERK_AUTHORIZED_PARTIES)=/.test(line));
writeFileSync(target, `${output.join('\n')}\n`, { mode: 0o600 });
console.log('Created apps/web/.env.vercel.local for import in Vercel. It is gitignored; values are not printed.');
