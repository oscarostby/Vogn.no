import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const requireWeb = createRequire(resolve(import.meta.dirname, '../apps/web/package.json'));
const { MongoClient } = requireWeb('mongodb');
const loginName = (process.argv[2] ?? 'oscar').toLowerCase();
if (!/^[a-z0-9_]{3,24}$/.test(loginName)) throw new Error('Invalid test login name');
if (process.env.TEST_AUTH_ENABLED !== 'true' || !process.env.MONGODB_URI) throw new Error('Configure private test auth and MongoDB first');
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB ?? 'vogn');
  const identity = await db.collection('privateTestIdentities').findOneAndUpdate({ _id: loginName }, { $setOnInsert: { identityId: `test:${randomUUID()}`, createdAt: new Date() } }, { upsert: true, returnDocument: 'after' });
  const ids = new Set((process.env.PLATFORM_ADMIN_CLERK_IDS ?? '').split(',').filter(Boolean));
  ids.add(identity.identityId);
  const path = resolve(import.meta.dirname, '../apps/web/.env.local');
  let content = readFileSync(path, 'utf8');
  const setting = `PLATFORM_ADMIN_CLERK_IDS=${[...ids].join(',')}`;
  content = /^PLATFORM_ADMIN_CLERK_IDS=/m.test(content) ? content.replace(/^PLATFORM_ADMIN_CLERK_IDS=.*$/m, setting) : content.trimEnd() + '\n' + setting + '\n';
  writeFileSync(path, content, { mode: 0o600 });
  await db.collection('users').updateOne({ clerkUserId: identity.identityId, status: { $ne: 'deleted' } }, { $set: { platformRole: 'admin' } });
  console.log(`Private test owner login prepared: ${loginName}. Re-export environment variables before deploying.`);
} catch (error) {
  console.error(`Test owner setup failed (${error instanceof Error ? error.name : 'unknown error'}).`);
  process.exitCode = 1;
} finally { await client.close(); }
