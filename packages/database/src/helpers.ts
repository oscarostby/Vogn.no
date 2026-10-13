import { type ClientSession, type MongoClient, MongoServerError, ObjectId } from 'mongodb';

export { ObjectId };

const OBJECT_ID_RE = /^[a-f0-9]{24}$/;

/** Parses a string id; returns null for malformed input (callers map that to NOT_FOUND). */
export function parseObjectId(value: unknown): ObjectId | null {
  if (typeof value !== 'string' || !OBJECT_ID_RE.test(value)) return null;
  return ObjectId.createFromHexString(value);
}

export function toObjectIds(values: readonly string[]): ObjectId[] {
  return values.map(parseObjectId).filter((v): v is ObjectId => v !== null);
}

export function idString(id: ObjectId | null | undefined): string | null {
  return id ? id.toHexString() : null;
}

export function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === 11000;
}

/* ------------------------------- pagination ------------------------------- */

/** Opaque cursor: base64url(JSON). Cursors carry sort keys only, never authorization state. */
export function encodeCursor(value: Record<string, string | number | null>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCursor<T extends Record<string, string | number | null>>(
  cursor: string | null | undefined,
  validate: (raw: Record<string, unknown>) => raw is T,
): T | null {
  if (!cursor) return null;
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && validate(raw as Record<string, unknown>)) return raw as T;
    return null;
  } catch {
    return null;
  }
}

/** Cursor for (date desc, _id desc) keyset pagination. */
export interface DateIdCursor extends Record<string, string | number | null> {
  t: number;
  id: string;
}

export const isDateIdCursor = (raw: Record<string, unknown>): raw is DateIdCursor =>
  typeof raw.t === 'number' && typeof raw.id === 'string' && OBJECT_ID_RE.test(raw.id);

export function dateIdCursorFilter(field: string, cursor: DateIdCursor | null): Record<string, unknown> {
  if (!cursor) return {};
  const at = new Date(cursor.t);
  const id = ObjectId.createFromHexString(cursor.id);
  return { $or: [{ [field]: { $lt: at } }, { [field]: at, _id: { $lt: id } }] };
}

export function nextDateIdCursor<T extends { _id: ObjectId }>(
  items: T[],
  limit: number,
  getDate: (item: T) => Date,
): string | null {
  if (items.length < limit) return null;
  const last = items[items.length - 1];
  if (!last) return null;
  return encodeCursor({ t: getDate(last).getTime(), id: last._id.toHexString() });
}

/** Cursor for (number desc, _id desc) keyset pagination (e.g. memberCount, activityScore). */
export interface NumberIdCursor extends Record<string, string | number | null> {
  n: number;
  id: string;
}

export const isNumberIdCursor = (raw: Record<string, unknown>): raw is NumberIdCursor =>
  typeof raw.n === 'number' && typeof raw.id === 'string' && OBJECT_ID_RE.test(raw.id);

export function numberIdCursorFilter(field: string, cursor: NumberIdCursor | null): Record<string, unknown> {
  if (!cursor) return {};
  const id = ObjectId.createFromHexString(cursor.id);
  return { $or: [{ [field]: { $lt: cursor.n } }, { [field]: cursor.n, _id: { $lt: id } }] };
}

/* ------------------------------ transactions ------------------------------ */

export interface TransactionOptions {
  /** Set false for standalone servers without replica sets (local dev only). */
  enabled?: boolean;
}

/**
 * Runs `fn` inside a MongoDB transaction (retrying transient errors via `withTransaction`).
 * When transactions are disabled the function runs without a session.
 */
export async function runTransaction<T>(
  client: MongoClient,
  fn: (session: ClientSession | undefined) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  if (options.enabled === false) return fn(undefined);
  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(
      async () => {
        result = await fn(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' },
    );
    return result as T;
  } finally {
    await session.endSession();
  }
}

export function now(): Date {
  return new Date();
}
