import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const web = resolve(import.meta.dirname, '../apps/web');
const requireWeb = createRequire(resolve(web, 'package.json'));
const env = { ...process.env, TEST_AUTH_ENABLED: 'true', NEXT_PUBLIC_TEST_AUTH_ENABLED: 'true', NEXT_PUBLIC_APP_URL: 'http://localhost:3100' };
const run = (args) => new Promise((done) => { const child = spawn(process.execPath, args, { cwd: web, env, stdio: 'inherit', windowsHide: true }); child.on('exit', (code) => done(code ?? 1)); child.on('error', () => done(1)); });
const build = await run([requireWeb.resolve('next/dist/bin/next'), 'build']);
process.exitCode = build || await run([requireWeb.resolve('@playwright/test/cli'), 'test']);
