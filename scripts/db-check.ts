import { closeCachedClient, getDb, verifyIndexes } from '@vogn/database';

async function main() { try {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');
  const { db } = await getDb({ uri: process.env.MONGODB_URI, dbName: process.env.MONGODB_DB ?? 'vogn' });
  await db.command({ ping: 1 });
  const missing = await verifyIndexes(db);
  console.log(JSON.stringify({ connected: true, database: db.databaseName, missingIndexes: missing }, null, 2));
  if (missing.length) process.exitCode = 1;
} catch (error) {
  // Driver errors can contain connection strings. Never echo their message.
  console.error(`Database check failed (${error instanceof Error ? error.name : 'unknown error'}).`);
  process.exitCode = 1;
} finally {
  await closeCachedClient();
}
}
void main();
