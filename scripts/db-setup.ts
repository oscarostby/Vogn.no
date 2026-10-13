import { closeCachedClient, ensureIndexes, getDb } from '@vogn/database';

async function main() { try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');
  const { db } = await getDb({ uri: process.env.MONGODB_URI, dbName: process.env.MONGODB_DB ?? 'vogn' });
  const report = await ensureIndexes(db);
  console.log(`Database ready: ${report.length} collections indexed.`);
} catch (error) {
  console.error(`Database setup failed (${error instanceof Error ? error.name : 'unknown error'}).`);
  process.exitCode = 1;
} finally {
  await closeCachedClient();
}
}
void main();
