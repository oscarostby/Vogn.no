import { type Db, MongoClient, type MongoClientOptions } from 'mongodb';

export interface DatabaseConfig {
  uri: string;
  dbName: string;
  appName?: string;
  /** Serverless functions should keep pools small; Atlas connection limits are per cluster tier. */
  maxPoolSize?: number;
}

interface CachedClient {
  key: string;
  client: MongoClient;
  promise: Promise<MongoClient>;
}

const globalForMongo = globalThis as typeof globalThis & { __vognMongo?: CachedClient };

export function createMongoClient(config: DatabaseConfig): MongoClient {
  const options: MongoClientOptions = {
    appName: config.appName ?? 'vogn',
    maxPoolSize: config.maxPoolSize ?? 10,
    minPoolSize: 0,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 8_000,
    retryWrites: true,
    retryReads: true,
  };
  return new MongoClient(config.uri, options);
}

/**
 * Returns a connected client, reusing one connection pool per process (and across hot reloads in dev).
 * Never import this from client-side code: the connection string is a server secret.
 */
export async function getMongoClient(config: DatabaseConfig): Promise<MongoClient> {
  const key = `${config.uri}|${config.appName ?? ''}`;
  const cached = globalForMongo.__vognMongo;
  if (cached && cached.key === key) return cached.promise;
  const client = createMongoClient(config);
  const promise = client.connect().catch((error: unknown) => {
    globalForMongo.__vognMongo = undefined;
    throw error;
  });
  globalForMongo.__vognMongo = { key, client, promise };
  return promise;
}

export async function getDb(config: DatabaseConfig): Promise<{ client: MongoClient; db: Db }> {
  const client = await getMongoClient(config);
  return { client, db: client.db(config.dbName) };
}

export async function closeCachedClient(): Promise<void> {
  const cached = globalForMongo.__vognMongo;
  globalForMongo.__vognMongo = undefined;
  if (cached) await cached.client.close();
}
