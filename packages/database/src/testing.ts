import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ensureIndexes } from './indexes';

/**
 * Isolated in-memory replica set for integration tests (transactions supported).
 * Never points at the configured Atlas cluster.
 */
export interface TestDatabase {
  client: MongoClient;
  db: Db;
  uri: string;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
}

export async function startTestDatabase(dbName = 'vogn_test'): Promise<TestDatabase> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    // First starts on Windows/CI can be slow (binary scanning, cold disk).
    instanceOpts: [{ launchTimeout: 120_000 }],
  });
  const uri = replSet.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await ensureIndexes(db);
  return {
    client,
    db,
    uri,
    stop: async () => {
      await client.close();
      await replSet.stop();
    },
    reset: async () => {
      const cols = await db.collections();
      await Promise.all(cols.map((c) => c.deleteMany({})));
    },
  };
}
