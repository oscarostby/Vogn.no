import 'server-only';
import type { CrewChannelDoc, PermissionOverwriteDoc } from '@vogn/database';
import { computeChannelPermissions } from '@vogn/permissions';
import type { CrewChannel, CrewSummary } from '@vogn/types';
import { type ChannelCreateInput, channelCreateSchema, channelUpdateSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import type { z } from 'zod';
import type { AuthedContext, ServiceContext } from '../context';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { CREW_SUMMARY_PROJECTION, toCrewSummary } from '../mappers';
import { audit } from './audit';
import { type CrewAccess, channelPermissions, getCrewAccess, getVisibleCrewAccess, requireMember, requirePermission, toMemberLike, toRoleLike } from './crew-access';
import { toCrewChannel } from './crew-mappers';
import { conversationDoc } from './crews';

const MAX_CHANNELS = 200;

async function readStatesFor(ctx: ServiceContext, conversationIds: ObjectId[]) {
  if (!ctx.actor || !conversationIds.length) return new Map<string, { lastReadSeq: number; mentionCount: number }>();
  const states = await ctx.cols.messageReadStates
    .find({ userId: ctx.actor.userId, conversationId: { $in: conversationIds } }, { projection: { conversationId: 1, lastReadSeq: 1, mentionCount: 1 } })
    .toArray();
  return new Map(states.map((s) => [s.conversationId.toHexString(), { lastReadSeq: s.lastReadSeq, mentionCount: s.mentionCount }]));
}

/** Channels visible to the viewer, with per-channel capabilities and unread state. */
export async function listChannels(ctx: ServiceContext, crewId: ObjectId): Promise<CrewChannel[]> {
  const access = await getVisibleCrewAccess(ctx, crewId);
  requireMember(access);
  return listChannelsForAccess(ctx, access);
}

export async function listChannelsForAccess(ctx: ServiceContext, access: CrewAccess): Promise<CrewChannel[]> {
  const channels = await ctx.cols.crewChannels.find({ crewId: access.crew._id, deletedAt: null }).sort({ position: 1 }).limit(MAX_CHANNELS).toArray();
  const visible = channels
    .map((ch) => ({ ch, perms: channelPermissions(access, ch) }))
    .filter(({ ch, perms }) => perms.has('VIEW_CHANNEL') || (ch.type === 'category' && perms.size > 0));
  const conversationIds = visible.map((v) => v.ch.conversationId).filter((c): c is ObjectId => Boolean(c));
  const [conversations, states] = await Promise.all([
    ctx.cols.conversations.find({ _id: { $in: conversationIds } }, { projection: { messageSeq: 1, lastMessageAt: 1 } }).toArray(),
    readStatesFor(ctx, conversationIds),
  ]);
  const convById = new Map(conversations.map((c) => [c._id.toHexString(), c]));
  const showOverwrites = access.permissions.has('EDIT_CHANNELS') || access.permissions.has('MANAGE_ROLES');
  const muted = Boolean(access.member?.mutedUntil && access.member.mutedUntil > ctx.now) || access.member?.notificationLevel === 'nothing';
  const visibleCategoryIds = new Set(visible.filter((v) => v.ch.type !== 'category').map((v) => v.ch.parentId?.toHexString()));
  return visible
    .filter(({ ch }) => ch.type !== 'category' || visibleCategoryIds.has(ch._id.toHexString()) || showOverwrites)
    .map(({ ch, perms }) => {
      const conv = ch.conversationId ? convById.get(ch.conversationId.toHexString()) : undefined;
      const state = ch.conversationId ? states.get(ch.conversationId.toHexString()) : undefined;
      return toCrewChannel(ch, perms, {
        lastSeq: conv?.messageSeq ?? 0,
        lastMessageAt: conv?.lastMessageAt ?? null,
        lastReadSeq: state?.lastReadSeq ?? (conv?.messageSeq ?? 0),
        mentionCount: state?.mentionCount ?? 0,
        muted,
        showOverwrites,
      });
    });
}

function toOverwrites(access: CrewAccess, overwrites: ChannelCreateInput['overwrites']): PermissionOverwriteDoc[] | undefined {
  if (!overwrites) return undefined;
  const roleIds = new Set(access.roles.map((r) => r._id.toHexString()));
  return overwrites.map((o) => {
    if (!roleIds.has(o.roleId)) throw badRequest('Unknown role in permission overwrite.');
    return { roleId: ObjectId.createFromHexString(o.roleId), allow: o.allow ?? [], deny: o.deny ?? [] };
  });
}

export async function createChannel(ctx: AuthedContext, crewId: ObjectId, raw: ChannelCreateInput): Promise<CrewChannel> {
  const input = channelCreateSchema.parse(raw);
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'CREATE_CHANNELS');
  if (input.overwrites?.length && !access.permissions.has('MANAGE_ROLES')) throw forbidden('Managing channel permissions requires Manage roles.');
  const count = await ctx.cols.crewChannels.countDocuments({ crewId, deletedAt: null });
  if (count >= MAX_CHANNELS) throw conflict(`A crew can have up to ${MAX_CHANNELS} channels.`);

  let parentId: ObjectId | null = null;
  if (input.parentId) {
    if (input.type === 'category') throw badRequest('Categories cannot be nested.');
    const parent = await ctx.cols.crewChannels.findOne({ _id: ObjectId.createFromHexString(input.parentId), crewId, type: 'category', deletedAt: null });
    if (!parent) throw notFound('Category');
    parentId = parent._id;
  }
  const last = await ctx.cols.crewChannels.find({ crewId, deletedAt: null }).sort({ position: -1 }).limit(1).next();
  const id = new ObjectId();
  const conversationId = input.type === 'voice' || input.type === 'category' ? null : new ObjectId();
  const doc: CrewChannelDoc = {
    _id: id,
    crewId,
    conversationId,
    name: input.name,
    type: input.type,
    parentId,
    position: (last?.position ?? 0) + 1,
    topic: input.topic ?? null,
    icon: input.icon ?? null,
    locked: input.locked ?? false,
    slowmodeSeconds: input.slowmodeSeconds ?? 0,
    overwrites: toOverwrites(access, input.overwrites) ?? [],
    deletedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.cols.crewChannels.insertOne(doc);
  if (conversationId) await ctx.cols.conversations.insertOne(conversationDoc(conversationId, crewId, id, ctx.now));
  await audit(ctx, { action: 'channel.created', targetType: 'channel', targetId: id, crewId, metadata: { type: input.type } });
  return toCrewChannel(doc, channelPermissions(access, doc), { lastSeq: 0, lastMessageAt: null, lastReadSeq: 0, mentionCount: 0, muted: false, showOverwrites: true });
}

export async function updateChannel(ctx: AuthedContext, crewId: ObjectId, channelId: ObjectId, raw: z.input<typeof channelUpdateSchema>): Promise<CrewChannel> {
  const input = channelUpdateSchema.parse(raw);
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'EDIT_CHANNELS');
  const channel = await ctx.cols.crewChannels.findOne({ _id: channelId, crewId, deletedAt: null });
  if (!channel) throw notFound('Channel');
  const set: Partial<CrewChannelDoc> = { updatedAt: ctx.now };
  if (input.name !== undefined) set.name = input.name;
  if (input.topic !== undefined) set.topic = input.topic ?? null;
  if (input.icon !== undefined) set.icon = input.icon ?? null;
  if (input.slowmodeSeconds !== undefined) set.slowmodeSeconds = input.slowmodeSeconds;
  if (input.locked !== undefined) set.locked = input.locked;
  if (input.parentId !== undefined) {
    if (input.parentId === null) set.parentId = null;
    else {
      const parent = await ctx.cols.crewChannels.findOne({ _id: ObjectId.createFromHexString(input.parentId), crewId, type: 'category', deletedAt: null });
      if (!parent || channel.type === 'category') throw badRequest('Invalid category.');
      set.parentId = parent._id;
    }
  }
  if (input.overwrites !== undefined) {
    if (!access.permissions.has('MANAGE_ROLES')) throw forbidden('Managing channel permissions requires Manage roles.');
    const overwrites = toOverwrites(access, input.overwrites)!;
    // Prevent locking yourself out: the actor must keep VIEW_CHANNEL after the change (unless owner/admin).
    const after = computeChannelPermissions(
      toMemberLike(access.member!, access.crew),
      access.roles.map(toRoleLike),
      { type: channel.type, locked: set.locked ?? channel.locked, overwrites: overwrites.map((o) => ({ roleId: o.roleId.toHexString(), allow: o.allow, deny: o.deny })) },
    );
    if (!after.has('VIEW_CHANNEL')) throw badRequest('This change would remove your own access to the channel.');
    set.overwrites = overwrites;
  }
  await ctx.cols.crewChannels.updateOne({ _id: channelId }, { $set: set });
  await audit(ctx, { action: 'channel.updated', targetType: 'channel', targetId: channelId, crewId, metadata: { fields: Object.keys(input) } });
  const updated = (await ctx.cols.crewChannels.findOne({ _id: channelId }))!;
  const conv = updated.conversationId ? await ctx.cols.conversations.findOne({ _id: updated.conversationId }, { projection: { messageSeq: 1, lastMessageAt: 1 } }) : null;
  return toCrewChannel(updated, channelPermissions(access, updated), {
    lastSeq: conv?.messageSeq ?? 0,
    lastMessageAt: conv?.lastMessageAt ?? null,
    lastReadSeq: conv?.messageSeq ?? 0,
    mentionCount: 0,
    muted: false,
    showOverwrites: true,
  });
}

export async function deleteChannel(ctx: AuthedContext, crewId: ObjectId, channelId: ObjectId): Promise<void> {
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'EDIT_CHANNELS');
  const channel = await ctx.cols.crewChannels.findOne({ _id: channelId, crewId, deletedAt: null });
  if (!channel) throw notFound('Channel');
  await ctx.cols.crewChannels.updateOne({ _id: channelId }, { $set: { deletedAt: ctx.now, updatedAt: ctx.now } });
  if (channel.type === 'category') {
    await ctx.cols.crewChannels.updateMany({ crewId, parentId: channelId, deletedAt: null }, { $set: { parentId: null, updatedAt: ctx.now } });
  }
  await audit(ctx, { action: 'channel.deleted', targetType: 'channel', targetId: channelId, crewId });
}

export async function reorderChannels(
  ctx: AuthedContext,
  crewId: ObjectId,
  items: { id: string; position: number; parentId: string | null }[],
): Promise<CrewChannel[]> {
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'EDIT_CHANNELS');
  const ids = items.map((i) => ObjectId.createFromHexString(i.id));
  const channels = await ctx.cols.crewChannels.find({ _id: { $in: ids }, crewId, deletedAt: null }).toArray();
  if (channels.length !== items.length) throw notFound('Channel');
  const categories = new Set(channels.filter((c) => c.type === 'category').map((c) => c._id.toHexString()));
  const allCategories = new Set(
    (await ctx.cols.crewChannels.find({ crewId, type: 'category', deletedAt: null }, { projection: { _id: 1 } }).toArray()).map((c) => c._id.toHexString()),
  );
  await ctx.cols.crewChannels.bulkWrite(
    items.map((item) => {
      if (item.parentId && (!allCategories.has(item.parentId) || categories.has(item.id))) throw badRequest('Invalid category.');
      return {
        updateOne: {
          filter: { _id: ObjectId.createFromHexString(item.id), crewId },
          update: { $set: { position: item.position, parentId: item.parentId ? ObjectId.createFromHexString(item.parentId) : null, updatedAt: ctx.now } },
        },
      };
    }),
  );
  return listChannelsForAccess(ctx, access);
}

/* --------------------------------- my crews --------------------------------- */

/** Crews the actor belongs to, with unread/mention indicators from channels they can actually see. */
export async function listMyCrews(ctx: AuthedContext): Promise<(CrewSummary & { unreadCount: number; mentionCount: number })[]> {
  const memberships = await ctx.cols.crewMembers.find({ userId: ctx.actor.userId, status: 'active' }).sort({ joinedAt: 1 }).limit(200).toArray();
  if (!memberships.length) return [];
  const crewIds = memberships.map((m) => m.crewId);
  const [crews, roles, channels] = await Promise.all([
    ctx.cols.crews.find({ _id: { $in: crewIds }, deletedAt: null }, { projection: { ...CREW_SUMMARY_PROJECTION, ownerId: 1 } }).toArray(),
    ctx.cols.crewRoles.find({ crewId: { $in: crewIds } }).toArray(),
    ctx.cols.crewChannels.find({ crewId: { $in: crewIds }, deletedAt: null, conversationId: { $ne: null } }, { projection: { crewId: 1, conversationId: 1, type: 1, locked: 1, overwrites: 1 } }).toArray(),
  ]);
  const rolesByCrew = new Map<string, typeof roles>();
  for (const r of roles) rolesByCrew.set(r.crewId.toHexString(), [...(rolesByCrew.get(r.crewId.toHexString()) ?? []), r]);
  const memberByCrew = new Map(memberships.map((m) => [m.crewId.toHexString(), m]));
  const visibleConversations: { crewId: string; conversationId: ObjectId }[] = [];
  for (const ch of channels) {
    const crewHex = ch.crewId.toHexString();
    const crew = crews.find((c) => c._id.equals(ch.crewId));
    const member = memberByCrew.get(crewHex);
    if (!crew || !member) continue;
    const perms = computeChannelPermissions(
      { userId: member.userId.toHexString(), roleIds: member.roleIds.map((r) => r.toHexString()), isOwner: crew.ownerId.equals(member.userId), timeoutUntil: member.timeoutUntil },
      (rolesByCrew.get(crewHex) ?? []).map(toRoleLike),
      { type: ch.type, locked: ch.locked, overwrites: ch.overwrites.map((o) => ({ roleId: o.roleId.toHexString(), allow: o.allow, deny: o.deny })) },
    );
    if (perms.has('VIEW_CHANNEL')) visibleConversations.push({ crewId: crewHex, conversationId: ch.conversationId! });
  }
  const convIds = visibleConversations.map((v) => v.conversationId);
  const [convs, states] = await Promise.all([
    ctx.cols.conversations.find({ _id: { $in: convIds } }, { projection: { messageSeq: 1 } }).toArray(),
    readStatesFor(ctx, convIds),
  ]);
  const seqById = new Map(convs.map((c) => [c._id.toHexString(), c.messageSeq]));
  const unread = new Map<string, { unread: number; mentions: number }>();
  for (const v of visibleConversations) {
    const hex = v.conversationId.toHexString();
    const seq = seqById.get(hex) ?? 0;
    const state = states.get(hex);
    const entry = unread.get(v.crewId) ?? { unread: 0, mentions: 0 };
    // Channels never opened don't count as unread (avoids a wall of dots after joining).
    if (state && seq > state.lastReadSeq) entry.unread += seq - state.lastReadSeq;
    entry.mentions += state?.mentionCount ?? 0;
    unread.set(v.crewId, entry);
  }
  const order = new Map(crewIds.map((id, i) => [id.toHexString(), i]));
  return crews
    .sort((a, b) => (order.get(a._id.toHexString()) ?? 0) - (order.get(b._id.toHexString()) ?? 0))
    .map((c) => ({ ...toCrewSummary(c), unreadCount: unread.get(c._id.toHexString())?.unread ?? 0, mentionCount: unread.get(c._id.toHexString())?.mentions ?? 0 }));
}
