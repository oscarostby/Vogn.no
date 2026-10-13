import 'server-only';
import { type ConversationDoc, decodeCursor, encodeCursor, isDateIdCursor, isDuplicateKeyError } from '@vogn/database';
import { type ConversationSummary, realtimeChannels, type UserSummary } from '@vogn/types';
import { ObjectId } from 'mongodb';
import type { AuthedContext, ServiceContext } from '../context';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { loadUserSummaries } from '../mappers';
import { audit } from './audit';
import { assertConversationAccess } from './conversation-access';
import { publishNow } from './outbox';
import { canDirectMessage } from './users';

const GROUP_MAX = 10;

async function summarize(ctx: ServiceContext, convs: ConversationDoc[]): Promise<ConversationSummary[]> {
  if (!convs.length) return [];
  const viewer = ctx.actor?.userId;
  const ids = convs.map((c) => c._id);
  const [members, states, channelNames] = await Promise.all([
    ctx.cols.conversationMembers.find({ conversationId: { $in: ids }, leftAt: null }, { projection: { conversationId: 1, userId: 1, muted: 1, mutedUntil: 1 } }).toArray(),
    viewer ? ctx.cols.messageReadStates.find({ userId: viewer, conversationId: { $in: ids } }).toArray() : Promise.resolve([]),
    ctx.cols.crewChannels.find({ _id: { $in: convs.map((c) => c.channelId).filter((x): x is ObjectId => Boolean(x)) } }, { projection: { name: 1 } }).toArray(),
  ]);
  const users = await loadUserSummaries(ctx.cols.users, members.map((m) => m.userId));
  const byConv = new Map<string, typeof members>();
  for (const m of members) byConv.set(m.conversationId.toHexString(), [...(byConv.get(m.conversationId.toHexString()) ?? []), m]);
  const stateBy = new Map(states.map((s) => [s.conversationId.toHexString(), s]));
  const channelName = new Map(channelNames.map((c) => [c._id.toHexString(), c.name]));
  return convs.map((c) => {
    const hex = c._id.toHexString();
    const convMembers = byConv.get(hex) ?? [];
    const others = convMembers.filter((m) => !viewer || !m.userId.equals(viewer)).map((m) => users.get(m.userId.toHexString())).filter((u): u is UserSummary => Boolean(u));
    const mine = convMembers.find((m) => viewer && m.userId.equals(viewer));
    const state = stateBy.get(hex);
    const isDm = c.kind === 'dm' || c.kind === 'group_dm';
    const lastReadSeq = state?.lastReadSeq ?? (isDm ? 0 : c.messageSeq);
    const title =
      c.kind === 'dm'
        ? (others[0]?.displayName ?? 'Direct message')
        : c.kind === 'group_dm'
          ? (c.name ?? others.map((o) => o.displayName).slice(0, 4).join(', '))
          : c.kind === 'channel'
            ? `#${(c.channelId && channelName.get(c.channelId.toHexString())) ?? 'channel'}`
            : (c.name ?? 'Thread');
    return {
      id: hex,
      kind: c.kind,
      title,
      crewId: c.crewId?.toHexString() ?? null,
      channelId: c.channelId?.toHexString() ?? null,
      parentConversationId: c.parentConversationId?.toHexString() ?? null,
      members: others.slice(0, 10),
      memberCount: isDm ? convMembers.length : c.memberCount,
      lastMessage:
        c.lastMessageId && c.lastMessagePreview && c.lastMessageAt
          ? { id: c.lastMessageId.toHexString(), senderName: c.lastMessagePreview.senderName, text: c.lastMessagePreview.text, createdAt: c.lastMessageAt.toISOString() }
          : null,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastSeq: c.messageSeq,
      lastReadSeq,
      unreadCount: Math.max(0, c.messageSeq - lastReadSeq),
      mentionCount: state?.mentionCount ?? 0,
      muted: Boolean(mine?.muted && (!mine.mutedUntil || mine.mutedUntil > ctx.now)),
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function listConversations(ctx: AuthedContext, cursor: string | undefined, limit = 30): Promise<{ items: ConversationSummary[]; nextCursor: string | null }> {
  const filter: Record<string, unknown> = { userId: ctx.actor.userId, leftAt: null, hidden: false };
  const c = decodeCursor(cursor, isDateIdCursor);
  if (c) filter.$or = [{ lastMessageAt: { $lt: new Date(c.t) } }, { lastMessageAt: new Date(c.t), _id: { $lt: ObjectId.createFromHexString(c.id) } }];
  const memberships = await ctx.cols.conversationMembers.find(filter).sort({ lastMessageAt: -1, _id: -1 }).limit(limit).toArray();
  const convs = await ctx.cols.conversations.find({ _id: { $in: memberships.map((m) => m.conversationId) } }).toArray();
  const order = new Map(memberships.map((m, i) => [m.conversationId.toHexString(), i]));
  convs.sort((a, b) => (order.get(a._id.toHexString()) ?? 0) - (order.get(b._id.toHexString()) ?? 0));
  const last = memberships[memberships.length - 1];
  return {
    items: await summarize(ctx, convs),
    nextCursor: memberships.length === limit && last ? encodeCursor({ t: (last.lastMessageAt ?? last.createdAt).getTime(), id: last._id.toHexString() }) : null,
  };
}

export async function getConversationSummary(ctx: AuthedContext, conversationId: ObjectId): Promise<ConversationSummary> {
  const access = await assertConversationAccess(ctx, conversationId);
  return (await summarize(ctx, [access.conversation]))[0]!;
}

function memberDoc(conversationId: ObjectId, userId: ObjectId, role: 'owner' | 'member', now: Date) {
  return { _id: new ObjectId(), conversationId, userId, role, muted: false, mutedUntil: null, hidden: false, lastMessageAt: now, leftAt: null, createdAt: now, updatedAt: now };
}

/** Opens (or returns) a 1:1 DM, or creates a group DM for 2–9 other people. */
export async function createConversation(ctx: AuthedContext, userIds: string[], name: string | null): Promise<ConversationSummary> {
  const me = ctx.actor.userId;
  const targets = [...new Set(userIds)].map((id) => ObjectId.createFromHexString(id)).filter((id) => !id.equals(me));
  if (!targets.length) throw badRequest('Choose at least one other person.');
  if (targets.length + 1 > GROUP_MAX) throw badRequest(`Group conversations can have up to ${GROUP_MAX} people.`);
  const users = await ctx.cols.users.find({ _id: { $in: targets }, status: 'active' }, { projection: { _id: 1 } }).toArray();
  if (users.length !== targets.length) throw notFound('User');
  for (const t of targets) {
    if (!(await canDirectMessage(ctx, me, t))) throw forbidden('One or more people do not accept messages from you.');
  }
  const now = new Date();

  if (targets.length === 1) {
    const peer = targets[0]!;
    const dmKey = [me.toHexString(), peer.toHexString()].sort().join(':');
    let conv = await ctx.cols.conversations.findOne({ dmKey });
    if (!conv) {
      conv = {
        _id: new ObjectId(),
        kind: 'dm',
        crewId: null,
        channelId: null,
        dmKey,
        name: null,
        createdBy: me,
        parentConversationId: null,
        rootMessageId: null,
        memberCount: 2,
        messageSeq: 0,
        lastMessageAt: now,
        lastMessageId: null,
        lastMessagePreview: null,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await ctx.cols.conversations.insertOne(conv);
        await ctx.cols.conversationMembers.insertMany([memberDoc(conv._id, me, 'member', now), memberDoc(conv._id, peer, 'member', now)]);
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        conv = (await ctx.cols.conversations.findOne({ dmKey }))!;
      }
    }
    // Re-join / unhide for the initiator.
    await ctx.cols.conversationMembers.updateOne(
      { conversationId: conv._id, userId: me },
      { $set: { hidden: false, leftAt: null, updatedAt: now }, $setOnInsert: { _id: new ObjectId(), role: 'member', muted: false, mutedUntil: null, lastMessageAt: now, createdAt: now } },
      { upsert: true },
    );
    return getConversationSummary(ctx, conv._id);
  }

  const conv: ConversationDoc = {
    _id: new ObjectId(),
    kind: 'group_dm',
    crewId: null,
    channelId: null,
    dmKey: null,
    name,
    createdBy: me,
    parentConversationId: null,
    rootMessageId: null,
    memberCount: targets.length + 1,
    messageSeq: 0,
    lastMessageAt: now,
    lastMessageId: null,
    lastMessagePreview: null,
    createdAt: now,
    updatedAt: now,
  };
  await ctx.cols.conversations.insertOne(conv);
  await ctx.cols.conversationMembers.insertMany([memberDoc(conv._id, me, 'owner', now), ...targets.map((t) => memberDoc(conv._id, t, 'member', now))]);
  await publishNow(
    ctx,
    targets.map((t) => ({ channel: realtimeChannels.user(t.toHexString()), name: 'conversation.created', payload: { type: 'conversation.created', conversationId: conv._id.toHexString() } })),
  ).catch(() => undefined);
  return getConversationSummary(ctx, conv._id);
}

export async function updateGroup(
  ctx: AuthedContext,
  conversationId: ObjectId,
  input: { name?: string | null; addUserIds?: string[]; removeUserId?: string },
): Promise<ConversationSummary> {
  const access = await assertConversationAccess(ctx, conversationId);
  if (access.conversation.kind !== 'group_dm') throw badRequest('Only group conversations can be edited.');
  const isOwner = access.member?.role === 'owner';
  const now = new Date();
  if (input.name !== undefined) await ctx.cols.conversations.updateOne({ _id: conversationId }, { $set: { name: input.name ?? null, updatedAt: now } });
  if (input.addUserIds?.length) {
    const current = await ctx.cols.conversationMembers.countDocuments({ conversationId, leftAt: null });
    if (current + input.addUserIds.length > GROUP_MAX) throw conflict(`Group conversations can have up to ${GROUP_MAX} people.`);
    for (const raw of input.addUserIds) {
      const id = ObjectId.createFromHexString(raw);
      if (!(await canDirectMessage(ctx, ctx.actor.userId, id))) throw forbidden('That person does not accept messages from you.');
      await ctx.cols.conversationMembers.updateOne(
        { conversationId, userId: id },
        { $set: { leftAt: null, hidden: false, updatedAt: now }, $setOnInsert: { _id: new ObjectId(), role: 'member', muted: false, mutedUntil: null, lastMessageAt: now, createdAt: now } },
        { upsert: true },
      );
    }
  }
  if (input.removeUserId) {
    const target = ObjectId.createFromHexString(input.removeUserId);
    if (!isOwner && !target.equals(ctx.actor.userId)) throw forbidden('Only the group owner can remove people.');
    await ctx.cols.conversationMembers.updateOne({ conversationId, userId: target }, { $set: { leftAt: now, updatedAt: now } });
  }
  const count = await ctx.cols.conversationMembers.countDocuments({ conversationId, leftAt: null });
  await ctx.cols.conversations.updateOne({ _id: conversationId }, { $set: { memberCount: count } });
  await audit(ctx, { action: 'conversation.updated', targetType: 'conversation', targetId: conversationId });
  return getConversationSummary(ctx, conversationId);
}

export async function leaveConversation(ctx: AuthedContext, conversationId: ObjectId): Promise<void> {
  const access = await assertConversationAccess(ctx, conversationId);
  const now = new Date();
  if (access.conversation.kind === 'dm') {
    // 1:1 DMs are hidden rather than left; they reappear when a new message arrives.
    await ctx.cols.conversationMembers.updateOne({ conversationId, userId: ctx.actor.userId }, { $set: { hidden: true, updatedAt: now } });
    return;
  }
  if (access.conversation.kind !== 'group_dm') throw badRequest('Use crew settings to leave channels.');
  await ctx.cols.conversationMembers.updateOne({ conversationId, userId: ctx.actor.userId }, { $set: { leftAt: now, updatedAt: now } });
  await ctx.cols.conversations.updateOne({ _id: conversationId }, { $inc: { memberCount: -1 } });
}

export async function muteConversation(ctx: AuthedContext, conversationId: ObjectId, muted: boolean, until: string | null | undefined): Promise<boolean> {
  const access = await assertConversationAccess(ctx, conversationId);
  if (!access.member) throw badRequest('Use crew notification settings for channels.');
  await ctx.cols.conversationMembers.updateOne({ _id: access.member._id }, { $set: { muted, mutedUntil: muted && until ? new Date(until) : null, updatedAt: new Date() } });
  return muted;
}
