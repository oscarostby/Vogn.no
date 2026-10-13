import 'server-only';
import { isDuplicateKeyError, type MessageDoc, runTransaction } from '@vogn/database';
import { type ChatMessage, type MessageSyncResult, realtimeChannels, type ReactionSummary, type UserSummary } from '@vogn/types';
import { extractMentions, parseMarkdown, toPlainText, truncate } from '@vogn/utils';
import { type MessageSendInput, messageSendSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import { runAfterResponse } from '../after';
import type { AuthedContext, ServiceContext } from '../context';
import { AppError, badRequest, conflict, forbidden, notFound } from '../errors';
import { loadUserSummaries } from '../mappers';
import { audit } from './audit';
import { assertConversationAccess, type ConversationAccess } from './conversation-access';
import { getCrewAccess } from './crew-access';
import { resolveOwnedMedia } from './media';
import { notify } from './notifications';
import { enqueueEvents, flushEvents, publishNow, type RealtimeEvent } from './outbox';

const MAX_REACTION_KINDS = 20;
const MAX_PINS = 50;
const EDIT_WINDOW_MS = 7 * 24 * 3600 * 1000;

/* ---------------------------------- mapping --------------------------------- */

function previewText(doc: Pick<MessageDoc, 'content' | 'attachments' | 'deletedAt'>): string {
  if (doc.deletedAt) return '';
  const text = toPlainText(parseMarkdown(doc.content));
  if (text) return truncate(text, 140);
  return doc.attachments.length ? `📎 ${doc.attachments.length} attachment${doc.attachments.length > 1 ? 's' : ''}` : '';
}

export async function toChatMessages(ctx: ServiceContext, docs: MessageDoc[]): Promise<ChatMessage[]> {
  if (!docs.length) return [];
  const replyIds = docs.map((d) => d.replyToId).filter((id): id is ObjectId => Boolean(id));
  const replies = replyIds.length ? await ctx.cols.messages.find({ _id: { $in: replyIds } }, { projection: { senderId: 1, content: 1, attachments: 1, deletedAt: 1 } }).toArray() : [];
  const users = await loadUserSummaries(ctx.cols.users, [...docs.map((d) => d.senderId), ...replies.map((r) => r.senderId)]);
  const mine = ctx.actor
    ? await ctx.cols.messageReactions
        .find({ messageId: { $in: docs.map((d) => d._id) }, userId: ctx.actor.userId }, { projection: { messageId: 1, emoji: 1 } })
        .toArray()
    : [];
  const mineSet = new Set(mine.map((m) => `${m.messageId.toHexString()}:${m.emoji}`));
  const replyById = new Map(replies.map((r) => [r._id.toHexString(), r]));
  return docs.map((d) => toChatMessage(d, users, mineSet, replyById));
}

function toChatMessage(
  d: MessageDoc,
  users: Map<string, UserSummary>,
  mine: Set<string>,
  replyById: Map<string, Pick<MessageDoc, '_id' | 'senderId' | 'content' | 'attachments' | 'deletedAt'>>,
): ChatMessage {
  const deleted = Boolean(d.deletedAt);
  const reply = d.replyToId ? replyById.get(d.replyToId.toHexString()) : undefined;
  const reactions: ReactionSummary[] = deleted
    ? []
    : d.reactions.filter((r) => r.count > 0).map((r) => ({ emoji: r.emoji, count: r.count, me: mine.has(`${d._id.toHexString()}:${r.emoji}`) }));
  return {
    id: d._id.toHexString(),
    conversationId: d.conversationId.toHexString(),
    seq: d.seq,
    sender: d.senderId ? (users.get(d.senderId.toHexString()) ?? null) : null,
    type: d.type,
    content: deleted ? '' : d.content,
    mentions: {
      userIds: d.mentions.userIds.map((u) => u.toHexString()),
      roleIds: d.mentions.roleIds.map((r) => r.toHexString()),
      everyone: d.mentions.everyone,
    },
    attachments: deleted
      ? []
      : d.attachments.map((a) => ({
          id: a.mediaId.toHexString(),
          kind: a.kind,
          url: a.url,
          thumbnailUrl: a.thumbnailUrl,
          name: a.name,
          mime: a.mime,
          size: a.size,
          width: a.width,
          height: a.height,
        })),
    embeds: deleted ? [] : d.embeds.map((e) => ({ kind: e.kind, id: e.refId?.toHexString() ?? null, url: e.url, title: e.title, description: e.description, imageUrl: e.imageUrl })),
    replyTo: d.replyToId
      ? {
          id: d.replyToId.toHexString(),
          sender: reply?.senderId ? (users.get(reply.senderId.toHexString()) ?? null) : null,
          preview: reply ? previewText(reply) : '',
          deleted: !reply || Boolean(reply.deletedAt),
        }
      : null,
    thread: d.threadId ? { id: d.threadId.toHexString(), replyCount: d.threadReplyCount, lastReplyAt: d.threadLastReplyAt?.toISOString() ?? null } : null,
    reactions,
    pinned: d.pinned && !deleted,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    editedAt: d.editedAt?.toISOString() ?? null,
    deletedAt: d.deletedAt?.toISOString() ?? null,
    idempotencyKey: d.idempotencyKey,
  };
}

/* ---------------------------------- history --------------------------------- */

export async function listMessages(
  ctx: ServiceContext,
  conversationId: ObjectId,
  q: { before?: number; after?: number; around?: number; limit: number },
): Promise<ChatMessage[]> {
  await assertConversationAccess(ctx, conversationId);
  const limit = Math.min(q.limit, 100);
  let docs: MessageDoc[];
  if (q.around) {
    const half = Math.floor(limit / 2);
    const [older, newer] = await Promise.all([
      ctx.cols.messages.find({ conversationId, seq: { $lte: q.around } }).sort({ seq: -1 }).limit(half + 1).toArray(),
      ctx.cols.messages.find({ conversationId, seq: { $gt: q.around } }).sort({ seq: 1 }).limit(half).toArray(),
    ]);
    docs = [...older.reverse(), ...newer];
  } else if (q.after !== undefined) {
    docs = await ctx.cols.messages.find({ conversationId, seq: { $gt: q.after } }).sort({ seq: 1 }).limit(limit).toArray();
  } else {
    const filter: Record<string, unknown> = { conversationId };
    if (q.before) filter.seq = { $lt: q.before };
    docs = (await ctx.cols.messages.find(filter).sort({ seq: -1 }).limit(limit).toArray()).reverse();
  }
  return toChatMessages(ctx, docs);
}

/** Reconciliation after reconnects: new messages after `afterSeq` plus edits/deletes since `updatedSince`. */
export async function syncMessages(
  ctx: ServiceContext,
  conversationId: ObjectId,
  q: { afterSeq: number; updatedSince?: string; limit: number },
): Promise<MessageSyncResult> {
  const access = await assertConversationAccess(ctx, conversationId);
  const [fresh, updated] = await Promise.all([
    ctx.cols.messages.find({ conversationId, seq: { $gt: q.afterSeq } }).sort({ seq: 1 }).limit(Math.min(q.limit, 200)).toArray(),
    q.updatedSince
      ? ctx.cols.messages
          .find({ conversationId, seq: { $lte: q.afterSeq }, updatedAt: { $gt: new Date(q.updatedSince) } })
          .sort({ updatedAt: 1 })
          .limit(200)
          .toArray()
      : Promise.resolve([]),
  ]);
  return {
    messages: await toChatMessages(ctx, fresh),
    updated: await toChatMessages(ctx, updated),
    lastSeq: access.conversation.messageSeq,
    serverTime: new Date().toISOString(),
  };
}

/* ----------------------------------- send ----------------------------------- */

async function buildEmbed(ctx: AuthedContext, embed: { kind: 'vehicle' | 'event'; id: string } | null | undefined, access: ConversationAccess) {
  if (!embed) return [];
  const id = ObjectId.createFromHexString(embed.id);
  if (embed.kind === 'vehicle') {
    const v = await ctx.cols.vehicles.findOne({ _id: id, deletedAt: null });
    // Only public vehicles or the sender's own vehicles can be shared (prevents leaking restricted builds).
    if (!v || (v.visibility !== 'public' && !v.ownerId.equals(ctx.actor.userId))) throw notFound('Vehicle');
    return [
      {
        kind: 'vehicle' as const,
        refId: v._id,
        url: `/v/${v._id.toHexString()}`,
        title: `${v.year ? `${v.year} ` : ''}${v.make} ${v.model}`,
        description: v.nickname ?? (v.specs.currentHp ? `${v.specs.currentHp} hp (owner-reported)` : null),
        imageUrl: (v.coverImage ?? v.gallery[0])?.url ?? null,
      },
    ];
  }
  const ev = await ctx.cols.events.findOne({ _id: id, deletedAt: null });
  if (!ev) throw notFound('Event');
  const sameCrew = access.crew && access.crew.crew._id.equals(ev.crewId);
  if (ev.visibility !== 'public' && !sameCrew) throw notFound('Event');
  return [
    {
      kind: 'event' as const,
      refId: ev._id,
      url: `/events/${ev._id.toHexString()}`,
      title: ev.title,
      description: ev.startsAt.toISOString(),
      imageUrl: ev.coverImage?.url ?? null,
    },
  ];
}

export async function sendMessage(ctx: AuthedContext, conversationId: ObjectId, raw: MessageSendInput): Promise<ChatMessage> {
  const input = messageSendSchema.parse(raw);
  const access = await assertConversationAccess(ctx, conversationId);
  if (!access.canSend) {
    if (access.blocked) throw forbidden('You cannot message this person.');
    throw forbidden('You cannot send messages here.');
  }
  if (ctx.actor.suspended) throw forbidden('Your account is suspended.');

  // Idempotent retries: same key from the same sender returns the original message.
  const existing = await ctx.cols.messages.findOne({ senderId: ctx.actor.userId, idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (!existing.conversationId.equals(conversationId)) throw conflict('Idempotency key reused.');
    return (await toChatMessages(ctx, [existing]))[0]!;
  }

  if (access.slowmodeSeconds > 0) {
    const recent = await ctx.cols.messages.findOne(
      { conversationId, senderId: ctx.actor.userId, createdAt: { $gt: new Date(ctx.now.getTime() - access.slowmodeSeconds * 1000) } },
      { projection: { createdAt: 1 } },
    );
    if (recent) {
      const wait = Math.ceil((recent.createdAt.getTime() + access.slowmodeSeconds * 1000 - ctx.now.getTime()) / 1000);
      throw new AppError('RATE_LIMITED', `Slow mode is on. Wait ${wait}s.`, { retryAfterSeconds: wait }, { 'Retry-After': String(wait) });
    }
  }

  if (input.attachmentIds.length && !access.canUpload) throw forbidden('You cannot upload attachments here.');
  const media = await resolveOwnedMedia(ctx, input.attachmentIds, ['message'], access.root._id);
  const attachments = media.map((m) => ({
    mediaId: m._id,
    kind: m.kind,
    url: m.url,
    thumbnailUrl: null,
    name: m.originalFilename ?? 'file',
    mime: m.mime,
    size: m.bytes,
    width: m.width,
    height: m.height,
  }));

  let replyToId: ObjectId | null = null;
  if (input.replyToId) {
    const target = await ctx.cols.messages.findOne({ _id: ObjectId.createFromHexString(input.replyToId), conversationId }, { projection: { _id: 1 } });
    if (!target) throw notFound('Message');
    replyToId = target._id;
  }

  const embeds = await buildEmbed(ctx, input.embed, access);
  const parsed = extractMentions(input.content);
  const mentions = await resolveMentions(ctx, access, parsed);

  const conversation = access.conversation;
  const crewId = access.crew?.crew._id ?? null;
  const now = new Date();
  let message!: MessageDoc;
  let outboxIds: ObjectId[] = [];

  try {
    await runTransaction(
      ctx.client,
      async (session) => {
        const updatedConv = await ctx.cols.conversations.findOneAndUpdate(
          { _id: conversationId },
          {
            $inc: { messageSeq: 1 },
            $set: {
              lastMessageAt: now,
              updatedAt: now,
              lastMessagePreview: { senderName: ctx.actor.displayName, text: truncate(toPlainText(parseMarkdown(input.content)) || (attachments.length ? '📎 Attachment' : ''), 140) },
            },
          },
          { returnDocument: 'after', session, projection: { messageSeq: 1 } },
        );
        if (!updatedConv) throw notFound('Conversation');
        message = {
          _id: new ObjectId(),
          conversationId,
          crewId,
          seq: updatedConv.messageSeq,
          senderId: ctx.actor.userId,
          type: embeds.length && !input.content ? (embeds[0]!.kind === 'vehicle' ? 'build_share' : 'event_share') : 'default',
          content: input.content,
          mentions,
          attachments,
          embeds,
          replyToId,
          threadId: null,
          threadReplyCount: 0,
          threadLastReplyAt: null,
          reactions: [],
          pinned: false,
          pinnedAt: null,
          pinnedBy: null,
          createdAt: now,
          updatedAt: now,
          editedAt: null,
          deletedAt: null,
          deletedBy: null,
          moderation: null,
          idempotencyKey: input.idempotencyKey,
        };
        await ctx.cols.messages.insertOne(message, { session });
        await ctx.cols.conversations.updateOne({ _id: conversationId }, { $set: { lastMessageId: message._id } }, { session });
        if (conversation.kind === 'dm' || conversation.kind === 'group_dm') {
          await ctx.cols.conversationMembers.updateMany({ conversationId, leftAt: null }, { $set: { lastMessageAt: now, hidden: false } }, { session });
        }
        const chat = (await toChatMessages(ctx, [message]))[0]!;
        const events: RealtimeEvent[] = [
          { channel: realtimeChannels.conversation(conversationId.toHexString()), name: 'message.created', payload: { type: 'message.created', message: chat } },
        ];
        if (conversation.kind === 'dm' || conversation.kind === 'group_dm') {
          const members = await ctx.cols.conversationMembers.find({ conversationId, leftAt: null }, { projection: { userId: 1 }, session }).toArray();
          for (const m of members) {
            if (m.userId.equals(ctx.actor.userId)) continue;
            events.push({
              channel: realtimeChannels.user(m.userId.toHexString()),
              name: 'conversation.activity',
              payload: { type: 'conversation.activity', conversationId: conversationId.toHexString(), crewId: null, lastSeq: message.seq, lastMessageAt: now.toISOString(), mention: true, senderId: ctx.actor.userId.toHexString() },
            });
          }
        }
        outboxIds = await enqueueEvents(ctx, events, session);
      },
      { enabled: ctx.transactions },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const dup = await ctx.cols.messages.findOne({ senderId: ctx.actor.userId, idempotencyKey: input.idempotencyKey });
      if (dup) return (await toChatMessages(ctx, [dup]))[0]!;
    }
    throw error;
  }

  // Delivery after commit. Failures remain in the outbox for the retry worker.
  await flushEvents(ctx, outboxIds).catch(() => undefined);
  await ctx.cols.messageReadStates.updateOne(
    { userId: ctx.actor.userId, conversationId },
    { $max: { lastReadSeq: message.seq }, $set: { mentionCount: 0, updatedAt: now }, $setOnInsert: { _id: new ObjectId() } },
    { upsert: true },
  );

  if (conversation.kind === 'thread' && conversation.rootMessageId && conversation.parentConversationId) {
    const rootId = conversation.rootMessageId;
    const parentId = conversation.parentConversationId;
    const root = await ctx.cols.messages.findOneAndUpdate(
      { _id: rootId },
      { $inc: { threadReplyCount: 1 }, $set: { threadLastReplyAt: now } },
      { returnDocument: 'after', projection: { threadReplyCount: 1, threadId: 1 } },
    );
    if (root) {
      await publishNow(ctx, [
        {
          channel: realtimeChannels.conversation(parentId.toHexString()),
          name: 'thread.updated',
          payload: { type: 'thread.updated', conversationId: parentId.toHexString(), messageId: rootId.toHexString(), threadId: conversationId.toHexString(), replyCount: root.threadReplyCount },
        },
      ]).catch(() => undefined);
    }
  }

  const sent = message;
  runAfterResponse(() => fanOutNotifications(ctx, access, sent));
  return (await toChatMessages(ctx, [message]))[0]!;
}

async function resolveMentions(ctx: AuthedContext, access: ConversationAccess, parsed: ReturnType<typeof extractMentions>): Promise<MessageDoc['mentions']> {
  const userIds = parsed.userIds.map((id) => ObjectId.createFromHexString(id));
  let roleIds: ObjectId[] = [];
  if (access.crew) {
    const mentionable = access.crew.roles.filter((r) => parsed.roleIds.includes(r._id.toHexString()) && (r.mentionable || access.canMentionEveryone));
    roleIds = mentionable.map((r) => r._id);
  }
  return {
    userIds,
    roleIds,
    // @everyone / @here only notify when the sender may mention everyone; otherwise they render as plain text.
    everyone: (parsed.everyone || parsed.here) && access.canMentionEveryone,
  };
}

/** Mention / reply / DM notifications, respecting crew notification levels, mutes and blocks. */
async function fanOutNotifications(ctx: AuthedContext, access: ConversationAccess, message: MessageDoc): Promise<void> {
  const conversation = access.conversation;
  const text = truncate(toPlainText(parseMarkdown(message.content)) || 'Sent an attachment', 140);
  const recipients = new Map<string, 'mention' | 'reply' | 'direct_message'>();

  if (conversation.kind === 'dm' || conversation.kind === 'group_dm') {
    const members = await ctx.cols.conversationMembers.find({ conversationId: conversation._id, leftAt: null }).toArray();
    for (const m of members) {
      if (m.userId.equals(ctx.actor.userId)) continue;
      if (m.muted && (!m.mutedUntil || m.mutedUntil > ctx.now)) continue;
      recipients.set(m.userId.toHexString(), 'direct_message');
    }
  } else if (access.crew) {
    const crewId = access.crew.crew._id;
    const targets = new Set(message.mentions.userIds.map((u) => u.toHexString()));
    if (message.mentions.roleIds.length) {
      const roleMembers = await ctx.cols.crewMembers.find({ crewId, status: 'active', roleIds: { $in: message.mentions.roleIds } }, { projection: { userId: 1 } }).limit(500).toArray();
      roleMembers.forEach((m) => targets.add(m.userId.toHexString()));
    }
    if (message.mentions.everyone) {
      const all = await ctx.cols.crewMembers.find({ crewId, status: 'active', suppressEveryone: false }, { projection: { userId: 1 } }).limit(1000).toArray();
      all.forEach((m) => targets.add(m.userId.toHexString()));
    }
    if (message.replyToId) {
      const parent = await ctx.cols.messages.findOne({ _id: message.replyToId }, { projection: { senderId: 1 } });
      if (parent?.senderId && !targets.has(parent.senderId.toHexString())) recipients.set(parent.senderId.toHexString(), 'reply');
    }
    targets.forEach((t) => recipients.set(t, 'mention'));
    recipients.delete(ctx.actor.userId.toHexString());
    if (!recipients.size) return;

    // Only notify members who can actually see the channel and haven't muted the crew.
    const memberDocs = await ctx.cols.crewMembers
      .find({ crewId, status: 'active', userId: { $in: [...recipients.keys()].map((id) => ObjectId.createFromHexString(id)) } })
      .toArray();
    const allowed = new Set<string>();
    const { channelPermissions, toMemberLike } = await import('./crew-access');
    for (const m of memberDocs) {
      if (m.notificationLevel === 'nothing' || (m.mutedUntil && m.mutedUntil > ctx.now)) continue;
      const memberAccess = { ...access.crew, member: m, memberLike: toMemberLike(m, access.crew.crew) };
      if (access.channel && !channelPermissions(memberAccess, access.channel).has('VIEW_CHANNEL')) continue;
      allowed.add(m.userId.toHexString());
    }
    for (const id of [...recipients.keys()]) if (!allowed.has(id)) recipients.delete(id);

    // Mention counters for unread badges.
    const mentioned = [...recipients.entries()].filter(([, kind]) => kind === 'mention').map(([id]) => ObjectId.createFromHexString(id));
    if (mentioned.length) {
      await ctx.cols.messageReadStates.bulkWrite(
        mentioned.map((userId) => ({
          updateOne: {
            filter: { userId, conversationId: conversation._id },
            update: { $inc: { mentionCount: 1 }, $set: { updatedAt: ctx.now }, $setOnInsert: { _id: new ObjectId(), lastReadSeq: message.seq - 1 } },
            upsert: true,
          },
        })),
      );
    }
  }

  const where = access.channel ? `#${access.channel.name}` : conversation.kind === 'group_dm' ? (conversation.name ?? 'a group') : null;
  const link = access.crew && access.channel ? `/c/${access.crew.crew.slug}/ch/${access.channel._id.toHexString()}?m=${message.seq}` : `/messages/${conversation._id.toHexString()}`;
  for (const [userHex, kind] of recipients) {
    const title =
      kind === 'direct_message'
        ? `${ctx.actor.displayName}${where ? ` in ${where}` : ''}`
        : kind === 'reply'
          ? `${ctx.actor.displayName} replied${where ? ` in ${where}` : ''}`
          : `${ctx.actor.displayName} mentioned you${where ? ` in ${where}` : ''}`;
    await notify(ctx, {
      userId: ObjectId.createFromHexString(userHex),
      type: kind,
      actorId: ctx.actor.userId,
      crewId: access.crew?.crew._id ?? null,
      title,
      body: text,
      link,
      groupKey: kind === 'direct_message' ? `dm:${conversation._id.toHexString()}` : null,
    });
  }
}

/* ------------------------------- edit & delete ------------------------------- */

async function loadMessage(ctx: ServiceContext, conversationId: ObjectId, messageId: ObjectId): Promise<MessageDoc> {
  const msg = await ctx.cols.messages.findOne({ _id: messageId, conversationId });
  if (!msg) throw notFound('Message');
  return msg;
}

async function publishUpdated(ctx: ServiceContext, doc: MessageDoc) {
  const chat = (await toChatMessages({ ...ctx, actor: null }, [doc]))[0]!;
  await publishNow(ctx, [
    { channel: realtimeChannels.conversation(doc.conversationId.toHexString()), name: 'message.updated', payload: { type: 'message.updated', message: chat } },
  ]).catch(() => undefined);
}

export async function editMessage(ctx: AuthedContext, conversationId: ObjectId, messageId: ObjectId, content: string): Promise<ChatMessage> {
  const access = await assertConversationAccess(ctx, conversationId);
  const msg = await loadMessage(ctx, conversationId, messageId);
  if (!msg.senderId?.equals(ctx.actor.userId)) throw forbidden('You can only edit your own messages.');
  if (msg.deletedAt) throw new AppError('GONE', 'Message was deleted.');
  if (!access.canSend) throw forbidden();
  if (ctx.now.getTime() - msg.createdAt.getTime() > EDIT_WINDOW_MS) throw forbidden('Messages can be edited for 7 days.');
  const mentions = await resolveMentions(ctx, access, extractMentions(content));
  const now = new Date();
  await ctx.cols.messages.updateOne({ _id: messageId }, { $set: { content, mentions, editedAt: now, updatedAt: now } });
  const updated = (await ctx.cols.messages.findOne({ _id: messageId }))!;
  await publishUpdated(ctx, updated);
  return (await toChatMessages(ctx, [updated]))[0]!;
}

async function softDelete(ctx: AuthedContext, msg: MessageDoc, byModerator: boolean, reason: string | null) {
  const now = new Date();
  await ctx.cols.messages.updateOne(
    { _id: msg._id },
    {
      $set: {
        deletedAt: now,
        deletedBy: ctx.actor.userId,
        content: '',
        attachments: [],
        embeds: [],
        reactions: [],
        pinned: false,
        updatedAt: now,
        ...(byModerator ? { moderation: { flagged: true, removedByModerator: true, reason } } : {}),
      },
    },
  );
  await ctx.cols.messageReactions.deleteMany({ messageId: msg._id });
  await publishNow(ctx, [
    {
      channel: realtimeChannels.conversation(msg.conversationId.toHexString()),
      name: 'message.deleted',
      payload: { type: 'message.deleted', conversationId: msg.conversationId.toHexString(), messageId: msg._id.toHexString(), seq: msg.seq, deletedAt: now.toISOString() },
    },
  ]).catch(() => undefined);
}

export async function deleteMessage(ctx: AuthedContext, conversationId: ObjectId, messageId: ObjectId): Promise<ChatMessage> {
  const access = await assertConversationAccess(ctx, conversationId);
  const msg = await loadMessage(ctx, conversationId, messageId);
  if (msg.deletedAt) return (await toChatMessages(ctx, [msg]))[0]!;
  const own = msg.senderId?.equals(ctx.actor.userId);
  if (!own && !access.canManageMessages) throw forbidden('You cannot delete this message.');
  await softDelete(ctx, msg, !own, null);
  if (!own) {
    await ctx.cols.moderationActions.insertOne({
      _id: new ObjectId(),
      scope: 'crew',
      crewId: access.crew?.crew._id ?? null,
      actorId: ctx.actor.userId,
      targetUserId: msg.senderId,
      action: 'delete_message',
      reason: null,
      targetRef: { type: 'message', id: msg._id },
      expiresAt: null,
      createdAt: ctx.now,
    });
    await audit(ctx, { action: 'moderation.delete_message', targetType: 'message', targetId: msg._id, crewId: access.crew?.crew._id ?? null });
  }
  return (await toChatMessages(ctx, [(await ctx.cols.messages.findOne({ _id: messageId }))!]))[0]!;
}

/** Used by crew moderation tools (message id only, with crew scope verification). */
export async function moderatorDeleteMessage(ctx: AuthedContext, messageId: ObjectId, reason: string | null, crewId: ObjectId): Promise<void> {
  const msg = await ctx.cols.messages.findOne({ _id: messageId, crewId });
  if (!msg) throw notFound('Message');
  const access = await assertConversationAccess(ctx, msg.conversationId);
  if (!access.canManageMessages) throw forbidden();
  if (!msg.deletedAt) await softDelete(ctx, msg, true, reason);
  await ctx.cols.moderationActions.insertOne({
    _id: new ObjectId(),
    scope: 'crew',
    crewId,
    actorId: ctx.actor.userId,
    targetUserId: msg.senderId,
    action: 'delete_message',
    reason,
    targetRef: { type: 'message', id: msg._id },
    expiresAt: null,
    createdAt: ctx.now,
  });
  await audit(ctx, { action: 'moderation.delete_message', targetType: 'message', targetId: msg._id, crewId });
}

/* --------------------------------- reactions --------------------------------- */

export async function setReaction(ctx: AuthedContext, conversationId: ObjectId, messageId: ObjectId, emoji: string, add: boolean): Promise<ChatMessage> {
  const access = await assertConversationAccess(ctx, conversationId);
  if (!access.canReact) throw forbidden('You cannot react here.');
  const msg = await loadMessage(ctx, conversationId, messageId);
  if (msg.deletedAt) throw new AppError('GONE', 'Message was deleted.');
  let count = msg.reactions.find((r) => r.emoji === emoji)?.count ?? 0;
  if (add) {
    if (!msg.reactions.some((r) => r.emoji === emoji) && msg.reactions.filter((r) => r.count > 0).length >= MAX_REACTION_KINDS) {
      throw conflict('This message has too many different reactions.');
    }
    try {
      await ctx.cols.messageReactions.insertOne({ _id: new ObjectId(), messageId, conversationId, userId: ctx.actor.userId, emoji, createdAt: ctx.now });
      const res = await ctx.cols.messages.updateOne({ _id: messageId, 'reactions.emoji': emoji }, { $inc: { 'reactions.$.count': 1 }, $set: { updatedAt: new Date() } });
      if (!res.matchedCount) await ctx.cols.messages.updateOne({ _id: messageId }, { $push: { reactions: { emoji, count: 1 } }, $set: { updatedAt: new Date() } });
      count += 1;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  } else {
    const res = await ctx.cols.messageReactions.deleteOne({ messageId, userId: ctx.actor.userId, emoji });
    if (res.deletedCount) {
      await ctx.cols.messages.updateOne({ _id: messageId, 'reactions.emoji': emoji }, { $inc: { 'reactions.$.count': -1 }, $set: { updatedAt: new Date() } });
      await ctx.cols.messages.updateOne({ _id: messageId }, { $pull: { reactions: { count: { $lte: 0 } } } });
      count = Math.max(0, count - 1);
    }
  }
  await publishNow(ctx, [
    {
      channel: realtimeChannels.conversation(conversationId.toHexString()),
      name: 'reaction.updated',
      payload: { type: 'reaction.updated', conversationId: conversationId.toHexString(), messageId: messageId.toHexString(), emoji, userId: ctx.actor.userId.toHexString(), op: add ? 'add' : 'remove', count },
    },
  ]).catch(() => undefined);
  if (add && msg.senderId && !msg.senderId.equals(ctx.actor.userId)) {
    await notify(ctx, {
      userId: msg.senderId,
      type: 'reaction',
      actorId: ctx.actor.userId,
      crewId: access.crew?.crew._id ?? null,
      title: `${ctx.actor.displayName} reacted ${emoji} to your message`,
      body: previewText(msg),
      link: access.crew && access.channel ? `/c/${access.crew.crew.slug}/ch/${access.channel._id.toHexString()}?m=${msg.seq}` : `/messages/${conversationId.toHexString()}`,
      groupKey: `reaction:${messageId.toHexString()}`,
    });
  }
  return (await toChatMessages(ctx, [(await ctx.cols.messages.findOne({ _id: messageId }))!]))[0]!;
}

/* ------------------------------------ pins ----------------------------------- */

export async function setPinned(ctx: AuthedContext, conversationId: ObjectId, messageId: ObjectId, pinned: boolean): Promise<ChatMessage> {
  const access = await assertConversationAccess(ctx, conversationId);
  if (!access.canPin) throw forbidden('You cannot pin messages here.');
  const msg = await loadMessage(ctx, conversationId, messageId);
  if (msg.deletedAt) throw new AppError('GONE', 'Message was deleted.');
  if (pinned && !msg.pinned) {
    const count = await ctx.cols.messages.countDocuments({ conversationId, pinned: true });
    if (count >= MAX_PINS) throw conflict(`Up to ${MAX_PINS} pinned messages per conversation.`);
  }
  const now = new Date();
  await ctx.cols.messages.updateOne(
    { _id: messageId },
    { $set: { pinned, pinnedAt: pinned ? now : null, pinnedBy: pinned ? ctx.actor.userId : null, updatedAt: now } },
  );
  await publishNow(ctx, [
    {
      channel: realtimeChannels.conversation(conversationId.toHexString()),
      name: 'pin.updated',
      payload: { type: 'pin.updated', conversationId: conversationId.toHexString(), messageId: messageId.toHexString(), pinned },
    },
  ]).catch(() => undefined);
  if (access.crew) await audit(ctx, { action: pinned ? 'message.pinned' : 'message.unpinned', targetType: 'message', targetId: messageId, crewId: access.crew.crew._id });
  return (await toChatMessages(ctx, [(await ctx.cols.messages.findOne({ _id: messageId }))!]))[0]!;
}

export async function listPins(ctx: ServiceContext, conversationId: ObjectId): Promise<ChatMessage[]> {
  await assertConversationAccess(ctx, conversationId);
  const docs = await ctx.cols.messages.find({ conversationId, pinned: true, deletedAt: null }).sort({ pinnedAt: -1 }).limit(MAX_PINS).toArray();
  return toChatMessages(ctx, docs);
}

/* ----------------------------------- search ---------------------------------- */

export async function searchMessages(ctx: ServiceContext, conversationId: ObjectId, q: string, beforeSeq: number | undefined, limit = 25): Promise<ChatMessage[]> {
  await assertConversationAccess(ctx, conversationId);
  const filter: Record<string, unknown> = { conversationId, deletedAt: null, $text: { $search: q } };
  if (beforeSeq) filter.seq = { $lt: beforeSeq };
  const docs = await ctx.cols.messages.find(filter, { projection: { score: { $meta: 'textScore' } } }).sort({ seq: -1 }).limit(Math.min(limit, 50)).toArray();
  return toChatMessages(ctx, docs as MessageDoc[]);
}

/* --------------------------------- read state --------------------------------- */

export async function markRead(ctx: AuthedContext, conversationId: ObjectId, seq: number): Promise<number> {
  const access = await assertConversationAccess(ctx, conversationId);
  const target = Math.min(seq, access.conversation.messageSeq);
  const res = await ctx.cols.messageReadStates.findOneAndUpdate(
    { userId: ctx.actor.userId, conversationId },
    { $max: { lastReadSeq: target }, $set: { mentionCount: 0, updatedAt: new Date() }, $setOnInsert: { _id: new ObjectId() } },
    { upsert: true, returnDocument: 'after' },
  );
  const lastReadSeq = res?.lastReadSeq ?? target;
  await publishNow(ctx, [
    {
      channel: realtimeChannels.user(ctx.actor.userId.toHexString()),
      name: 'read.updated',
      payload: { type: 'read.updated', conversationId: conversationId.toHexString(), lastReadSeq },
    },
  ]).catch(() => undefined);
  return lastReadSeq;
}

/* ------------------------------------ threads ----------------------------------- */

export async function openThread(ctx: AuthedContext, conversationId: ObjectId, messageId: ObjectId): Promise<ObjectId> {
  const access = await assertConversationAccess(ctx, conversationId);
  if (access.conversation.kind === 'thread') throw badRequest('Threads cannot be nested.');
  const msg = await loadMessage(ctx, conversationId, messageId);
  if (msg.threadId) return msg.threadId;
  if (!access.canSend) throw forbidden();
  const threadId = new ObjectId();
  const now = new Date();
  // Atomic claim: only one thread per root message.
  const claimed = await ctx.cols.messages.findOneAndUpdate({ _id: messageId, threadId: null }, { $set: { threadId, updatedAt: now } }, { returnDocument: 'after' });
  if (!claimed) return (await ctx.cols.messages.findOne({ _id: messageId }, { projection: { threadId: 1 } }))!.threadId!;
  await ctx.cols.conversations.insertOne({
    _id: threadId,
    kind: 'thread',
    crewId: access.conversation.crewId,
    channelId: access.conversation.channelId,
    dmKey: null,
    name: truncate(previewText(msg) || 'Thread', 60),
    createdBy: ctx.actor.userId,
    parentConversationId: conversationId,
    rootMessageId: messageId,
    memberCount: 0,
    messageSeq: 0,
    lastMessageAt: null,
    lastMessageId: null,
    lastMessagePreview: null,
    createdAt: now,
    updatedAt: now,
  });
  await publishUpdated(ctx, claimed);
  return threadId;
}

export async function getCrewForConversation(ctx: ServiceContext, conversationId: ObjectId) {
  const conv = await ctx.cols.conversations.findOne({ _id: conversationId }, { projection: { crewId: 1 } });
  return conv?.crewId ? getCrewAccess(ctx, conv.crewId) : null;
}
