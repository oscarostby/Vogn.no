import 'server-only';
import type { NotificationDoc } from '@vogn/database';
import { NOTIFICATION_PREFERENCE_KEY, type NotificationItem, type NotificationType, realtimeChannels } from '@vogn/types';
import { isWithinQuietHours } from '@vogn/utils';
import { ObjectId } from 'mongodb';
import type { AuthedContext, ServiceContext } from '../context';
import { sendPush } from '../integrations/push';
import { log } from '../log';
import { decodeCursor, encodeCursor, isDateIdCursor } from '@vogn/database';
import { loadUserSummaries } from '../mappers';
import { publishNow } from './outbox';
import { runAfterResponse } from '../after';

export interface NotifyInput {
  userId: ObjectId;
  type: NotificationType;
  actorId?: ObjectId | null;
  crewId?: ObjectId | null;
  title: string;
  body?: string | null;
  link?: string | null;
  /** Repeated events with the same key update a single unread notification. */
  groupKey?: string | null;
}

const RETENTION_MS = 180 * 24 * 3600 * 1000;

/**
 * Creates an in-app notification (respecting preferences and blocks), publishes a realtime hint and sends
 * push notifications after the response (respecting push preferences and quiet hours).
 */
export async function notify(ctx: ServiceContext, input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId.equals(input.userId)) return;
  const [settings, blocked] = await Promise.all([
    ctx.cols.userSettings.findOne({ userId: input.userId }, { projection: { notifications: 1 } }),
    input.actorId
      ? ctx.cols.userBlocks.findOne({ blockerId: input.userId, blockedId: input.actorId }, { projection: { _id: 1 } })
      : null,
  ]);
  if (blocked) return;
  const key = NOTIFICATION_PREFERENCE_KEY[input.type];
  const prefs = settings?.notifications;
  const security = input.type === 'security_alert';
  if (!security && prefs && prefs.inApp[key] === false) return;

  const now = ctx.now;
  let notificationId: ObjectId;
  if (input.groupKey) {
    const res = await ctx.cols.notifications.findOneAndUpdate(
      { userId: input.userId, groupKey: input.groupKey, readAt: null },
      {
        $set: { title: input.title, body: input.body ?? null, link: input.link ?? null, actorId: input.actorId ?? null, createdAt: now },
        $setOnInsert: {
          _id: new ObjectId(),
          userId: input.userId,
          type: input.type,
          crewId: input.crewId ?? null,
          groupKey: input.groupKey,
          readAt: null,
          expireAt: new Date(now.getTime() + RETENTION_MS),
        },
      },
      { upsert: true, returnDocument: 'after', projection: { _id: 1 } },
    );
    notificationId = res!._id;
  } else {
    const doc: NotificationDoc = {
      _id: new ObjectId(),
      userId: input.userId,
      type: input.type,
      actorId: input.actorId ?? null,
      crewId: input.crewId ?? null,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      groupKey: null,
      readAt: null,
      createdAt: now,
      expireAt: new Date(now.getTime() + RETENTION_MS),
    };
    await ctx.cols.notifications.insertOne(doc);
    notificationId = doc._id;
  }

  await publishNow(ctx, [
    {
      channel: realtimeChannels.user(input.userId.toHexString()),
      name: 'notification.created',
      payload: { type: 'notification.created', notificationId: notificationId.toHexString() },
    },
  ]).catch((error: unknown) => log.warn('notification realtime publish failed', { error }));

  const wantsPush = security || !prefs || prefs.push[key] !== false;
  if (!wantsPush) return;
  if (!security && prefs?.quietHours.enabled && isWithinQuietHours(now, prefs.quietHours.start, prefs.quietHours.end, prefs.quietHours.timezone)) {
    return;
  }
  const userId = input.userId;
  runAfterResponse(async () => {
    const tokens = await ctx.cols.pushTokens.find({ userId }, { projection: { token: 1 } }).toArray();
    if (!tokens.length) return;
    const tickets = await sendPush(
      tokens.map((t) => ({
        to: t.token,
        title: input.title,
        body: input.body ?? undefined,
        sound: 'default',
        data: { link: input.link ?? '/notifications', type: input.type },
      })),
    );
    // Remove tokens Expo reports as unregistered.
    const dead = tickets
      .map((t, i) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? tokens[i]?.token : null))
      .filter((t): t is string => Boolean(t));
    if (dead.length) await ctx.cols.pushTokens.deleteMany({ token: { $in: dead } });
  });
}

export async function listNotifications(ctx: AuthedContext, cursor: string | undefined, limit = 30) {
  const c = decodeCursor(cursor, isDateIdCursor);
  const filter: Record<string, unknown> = { userId: ctx.actor.userId };
  if (c) {
    const at = new Date(c.t);
    const id = ObjectId.createFromHexString(c.id);
    filter.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: id } }];
  }
  const docs = await ctx.cols.notifications.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
  const actors = await loadUserSummaries(ctx.cols.users, docs.map((d) => d.actorId));
  const items: NotificationItem[] = docs.map((d) => ({
    id: d._id.toHexString(),
    type: d.type,
    actor: d.actorId ? (actors.get(d.actorId.toHexString()) ?? null) : null,
    title: d.title,
    body: d.body,
    link: d.link,
    crewId: d.crewId?.toHexString() ?? null,
    readAt: d.readAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));
  const last = docs[docs.length - 1];
  const nextCursor = docs.length === limit && last ? encodeCursor({ t: last.createdAt.getTime(), id: last._id.toHexString() }) : null;
  return { items, nextCursor };
}

export async function unreadNotificationCount(ctx: AuthedContext): Promise<number> {
  return ctx.cols.notifications.countDocuments({ userId: ctx.actor.userId, readAt: null }, { limit: 100 });
}

export async function markNotificationsRead(ctx: AuthedContext, input: { ids: string[] } | { all: true }): Promise<number> {
  const filter: Record<string, unknown> = { userId: ctx.actor.userId, readAt: null };
  if ('ids' in input) filter._id = { $in: input.ids.map((id) => ObjectId.createFromHexString(id)) };
  const res = await ctx.cols.notifications.updateMany(filter, { $set: { readAt: ctx.now } });
  return res.modifiedCount;
}
