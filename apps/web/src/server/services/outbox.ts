import 'server-only';
import type { OutboxDoc } from '@vogn/database';
import { ObjectId } from 'mongodb';
import type { ServiceContext, Session } from '../context';
import { publishEvent, realtimeAvailable } from '../integrations/ably';
import { log } from '../log';

export interface RealtimeEvent {
  channel: string;
  name: string;
  payload: unknown;
}

const MAX_ATTEMPTS = 8;
const SENT_RETENTION_MS = 24 * 3600 * 1000;

/**
 * Writes events to the transactional outbox (same session as the domain write). Returns the outbox ids so
 * the caller can attempt immediate delivery after commit. No-op when realtime is not configured: MongoDB
 * remains authoritative and clients reconcile through the sync endpoints.
 */
export async function enqueueEvents(ctx: ServiceContext, events: RealtimeEvent[], session?: Session): Promise<ObjectId[]> {
  if (!events.length || !realtimeAvailable()) return [];
  const docs: OutboxDoc[] = events.map((e) => ({
    _id: new ObjectId(),
    channel: e.channel,
    name: e.name,
    payload: e.payload,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: ctx.now,
    lastError: null,
    createdAt: ctx.now,
    sentAt: null,
    expireAt: null,
  }));
  await ctx.cols.messageOutbox.insertMany(docs, { session });
  return docs.map((d) => d._id);
}

async function deliver(ctx: ServiceContext, doc: OutboxDoc): Promise<boolean> {
  try {
    await publishEvent(doc.channel, doc.name, doc.payload, doc._id.toHexString());
    const now = new Date();
    await ctx.cols.messageOutbox.updateOne(
      { _id: doc._id },
      { $set: { status: 'sent', sentAt: now, expireAt: new Date(now.getTime() + SENT_RETENTION_MS), lastError: null } },
    );
    return true;
  } catch (error) {
    const attempts = doc.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    const backoffMs = Math.min(15 * 60_000, 2 ** attempts * 1000);
    await ctx.cols.messageOutbox.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: failed ? 'failed' : 'pending',
          attempts,
          nextAttemptAt: new Date(Date.now() + backoffMs),
          lastError: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
          expireAt: failed ? new Date(Date.now() + 7 * SENT_RETENTION_MS) : null,
        },
      },
    );
    log.warn('realtime publish failed', { outboxId: doc._id.toHexString(), attempts, failed });
    return false;
  }
}

/** Best-effort immediate delivery after commit. Failures stay pending for the cron worker. */
export async function flushEvents(ctx: ServiceContext, ids: ObjectId[]): Promise<void> {
  if (!ids.length) return;
  const docs = await ctx.cols.messageOutbox.find({ _id: { $in: ids }, status: 'pending' }).sort({ _id: 1 }).toArray();
  for (const doc of docs) await deliver(ctx, doc);
}

/** Convenience for writes that don't need a transaction. */
export async function publishNow(ctx: ServiceContext, events: RealtimeEvent[]): Promise<void> {
  const ids = await enqueueEvents(ctx, events);
  await flushEvents(ctx, ids);
}

/** Cron worker: retries due events in creation order. */
export async function processDueOutbox(ctx: ServiceContext, limit = 200): Promise<{ attempted: number; delivered: number }> {
  const due = await ctx.cols.messageOutbox
    .find({ status: 'pending', nextAttemptAt: { $lte: new Date() } })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
  let delivered = 0;
  for (const doc of due) if (await deliver(ctx, doc)) delivered++;
  return { attempted: due.length, delivered };
}
