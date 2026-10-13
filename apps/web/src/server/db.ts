import 'server-only';
import { type Collections, collections, ensureIndexes, getDb } from '@vogn/database';
import type { Db, MongoClient } from 'mongodb';
import { getEnv, missingVars } from './env';
import { configMissing } from './errors';

export interface Database {
  client: MongoClient;
  db: Db;
  cols: Collections;
  transactions: boolean;
}

let override: Database | null = null;
let indexedClient: MongoClient | null = null;
let indexedDbName: string | null = null;
let indexesReady: Promise<unknown> | null = null;

/** Integration tests inject an isolated in-memory replica set. */
export function setDatabaseForTests(client: MongoClient, db: Db): void {
  override = { client, db, cols: collections(db), transactions: true };
}

export async function getDatabase(): Promise<Database> {
  if (override) return override;
  const env = getEnv();
  if (!env.MONGODB_URI) throw configMissing('MongoDB', missingVars('database', env));
  const { client, db } = await getDb({
    uri: env.MONGODB_URI,
    dbName: env.MONGODB_DB,
    appName: 'vogn-web',
    maxPoolSize: 10,
  });
  // First deploy is usable without a separate terminal migration. Failed setup can retry.
  if (indexedClient !== client || indexedDbName !== db.databaseName) {
    indexedClient = client;
    indexedDbName = db.databaseName;
    indexesReady = Promise.all([ensureIndexes(db), db.collection('privateTestIdentities').createIndex({ identityId: 1 }, { unique: true })]).catch((error: unknown) => {
      indexedClient = null;
      indexedDbName = null;
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
  return { client, db, cols: collections(db), transactions: env.MONGODB_TRANSACTIONS };
}
