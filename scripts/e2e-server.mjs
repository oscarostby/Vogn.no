import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const web = resolve(import.meta.dirname, '../apps/web');
const requireWeb = createRequire(resolve(web, 'package.json'));
const { MongoMemoryReplSet } = requireWeb('mongodb-memory-server');
const { MongoClient } = requireWeb('mongodb');
const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ launchTimeout: 120000 }] });
const owner = `test:${randomUUID()}`;
const client = new MongoClient(replica.getUri());
await client.connect();
await client.db('vogn_browser_test').collection('privateTestIdentities').insertOne({ _id: 'owner_ui', identityId: owner, createdAt: new Date() });
await client.close();

const next = spawn(process.execPath, [requireWeb.resolve('next/dist/bin/next'), 'start', '--port', '3100'], {
  cwd: web, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, NODE_ENV: 'production', MONGODB_URI: replica.getUri(), MONGODB_DB: 'vogn_browser_test', MONGODB_TRANSACTIONS: 'true', NEXT_PUBLIC_APP_URL: 'http://localhost:3100',
    TEST_AUTH_ENABLED: 'true', NEXT_PUBLIC_TEST_AUTH_ENABLED: 'true', TEST_AUTH_PASSWORD: 'e2e-private-only-password-12345', TEST_MEDIA_ENABLED: 'true',
    APP_SIGNING_SECRET: 'e2e-signing-key-only-0123456789abcdef0123456789', DATA_ENCRYPTION_KEY: Buffer.alloc(32, 19).toString('base64'), PLATFORM_ADMIN_CLERK_IDS: owner,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '', CLERK_SECRET_KEY: '', ABLY_API_KEY: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '', CLOUDINARY_CLOUD_NAME: '',
  },
});
let closing = false;
async function close() { if (closing) return; closing = true; next.kill(); await replica.stop(); }
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
next.on('exit', async (code) => { await close(); process.exitCode = code ?? 0; });
