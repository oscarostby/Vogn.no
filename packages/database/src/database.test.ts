import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collections } from './collections';
import { decodeCursor, encodeCursor, isDateIdCursor, isDuplicateKeyError, ObjectId, runTransaction } from './helpers';
import { verifyIndexes } from './indexes';
import { startTestDatabase, type TestDatabase } from './testing';

let t: TestDatabase;

beforeAll(async () => {
  t = await startTestDatabase('vogn_db_test');
});

afterAll(async () => {
  await t?.stop();
});

describe('indexes', () => {
  it('creates every declared index', async () => {
    expect(await verifyIndexes(t.db)).toEqual([]);
  });

  it('enforces unique usernames case-insensitively via usernameLower', async () => {
    const c = collections(t.db);
    const base = {
      clerkUserId: 'user_a',
      username: 'Turbo',
      usernameLower: 'turbo',
      displayName: 'Turbo',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await c.users.insertOne({ _id: new ObjectId(), ...base } as never);
    await expect(
      c.users.insertOne({ _id: new ObjectId(), ...base, clerkUserId: 'user_b', username: 'TURBO' } as never),
    ).rejects.toSatisfy(isDuplicateKeyError);
  });

  it('prevents duplicate message idempotency keys per sender', async () => {
    const c = collections(t.db);
    const senderId = new ObjectId();
    const conversationId = new ObjectId();
    const doc = (seq: number) => ({
      _id: new ObjectId(),
      conversationId,
      seq,
      senderId,
      idempotencyKey: 'abcdefgh1234',
      content: 'hi',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await c.messages.insertOne(doc(1) as never);
    await expect(c.messages.insertOne(doc(2) as never)).rejects.toSatisfy(isDuplicateKeyError);
  });
});

describe('transactions', () => {
  it('rolls back all writes when the callback throws', async () => {
    const c = collections(t.db);
    const id = new ObjectId();
    await expect(
      runTransaction(t.client, async (session) => {
        await c.jobLocks.insertOne({ _id: id.toHexString(), lockedUntil: new Date(), lastRunAt: null }, { session });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await c.jobLocks.findOne({ _id: id.toHexString() })).toBeNull();
  });
});

describe('cursors', () => {
  it('round-trips and rejects tampered cursors', () => {
    const cursor = encodeCursor({ t: 123, id: 'a'.repeat(24) });
    expect(decodeCursor(cursor, isDateIdCursor)).toEqual({ t: 123, id: 'a'.repeat(24) });
    expect(decodeCursor('not-a-cursor', isDateIdCursor)).toBeNull();
    expect(decodeCursor(encodeCursor({ t: 1, id: '$where' }), isDateIdCursor)).toBeNull();
  });
});
