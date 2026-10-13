import { readFileSync, readdirSync, existsSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';

const web = resolve(import.meta.dirname, '../apps/web');
const requireWeb = createRequire(join(web, 'package.json'));
const source = readFileSync(join(web, 'src/server/private-test-defaults.ts'), 'utf8');
const defaults = JSON.parse(source.match(/PRIVATE_TEST_DEFAULTS = (\{[\s\S]*\}) as const;/)[1]);
const localEnv = join(web, '.env.local');
const backup = join(web, '.env.local.no-env-check');
if (existsSync(backup)) throw new Error('An earlier environment backup must be restored first.');
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !(key in defaults) && key !== 'NEXT_PUBLIC_APP_URL'));
let renamed = false;
let server;
try {
  if (existsSync(localEnv)) { renameSync(localEnv, backup); renamed = true; }
  const build = await new Promise((done) => {
    const child = spawn(process.execPath, [requireWeb.resolve('next/dist/bin/next'), 'build'], { cwd: web, env: clean, windowsHide: true, stdio: 'inherit' });
    child.on('exit', (code) => done(code ?? 1)); child.on('error', () => done(1));
  });
  if (build) throw new Error('BuildFailed');
  const secretValues = ['MONGODB_URI', 'DATA_ENCRYPTION_KEY', 'APP_SIGNING_SECRET', 'TEST_AUTH_PASSWORD', 'CRON_SECRET'].map((key) => defaults[key]);
  secretValues.push(decodeURIComponent(new URL(defaults.MONGODB_URI).password));
  let bundleCount = 0;
  function scan(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name.endsWith('.js')) {
        bundleCount++;
        const content = readFileSync(file, 'utf8');
        if (secretValues.some((secret) => secret && content.includes(secret))) throw new Error('ClientBundleContainsSecret');
      }
    }
  }
  scan(join(web, '.next/static'));
  console.log(`Client bundle scan passed (${bundleCount} JavaScript files; no server secret values).`);
  server = spawn(process.execPath, [requireWeb.resolve('next/dist/bin/next'), 'start', '--port', '3299'], { cwd: web, env: clean, windowsHide: true, stdio: 'ignore' });
  let health;
  for (let i = 0; i < 60; i++) {
    await new Promise((done) => setTimeout(done, 250));
    try { health = await (await fetch('http://localhost:3299/api/v1/health')).json(); break; } catch { /* wait for startup */ }
  }
  if (health?.data?.status !== 'ok' || !health.data.database.ok) throw new Error('NoEnvHealthFailed');
  const guard = await fetch('http://localhost:3299/home', { redirect: 'manual' });
  if (!guard.headers.get('location')?.includes('/sign-in')) throw new Error('NoEnvPageGuardFailed');
  const login = await fetch('http://localhost:3299/api/test-auth/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3299' },
    body: JSON.stringify({ loginName: 'oscar', password: defaults.TEST_AUTH_PASSWORD }),
  });
  if (!login.ok || !(await login.json()).data?.signedIn) throw new Error('NoEnvLoginFailed');
  const signin = await (await fetch('http://localhost:3299/sign-in')).text();
  if (!signin.includes('Private test password')) throw new Error('NoEnvClientFlagFailed');
  console.log('No-env production smoke passed: Atlas health, page guard, test login and sign-in UI.');
} catch (error) {
  // Never include driver messages or values from assertions in output.
  console.error(`No-env verification failed (${error instanceof Error ? error.message : 'unknown'}).`);
  process.exitCode = 1;
} finally {
  server?.kill();
  if (renamed) renameSync(backup, localEnv);
}
