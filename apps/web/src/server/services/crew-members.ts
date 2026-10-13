import 'server-only';
import { type CrewRoleDoc, decodeCursor, encodeCursor, isDateIdCursor } from '@vogn/database';
import { canGrantPermissions, canManageRole, canModerateMember, highestPosition } from '@vogn/permissions';
import { type CrewMember, type CrewPermission, type CrewRole, type ModerationActionDto, realtimeChannels } from '@vogn/types';
import { type CrewModerationInput, crewModerationSchema, roleCreateSchema, roleUpdateSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import type { z } from 'zod';
import type { AuthedContext } from '../context';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { loadUserSummaries, toUserSummary, USER_SUMMARY_PROJECTION, type UserSummaryDoc } from '../mappers';
import { audit } from './audit';
import { type CrewAccess, getCrewAccess, requireMember, requirePermission, toMemberLike, toRoleLike } from './crew-access';
import { toCrewMember, toCrewRole } from './crew-mappers';
import { moderatorDeleteMessage } from './messages';
import { notify } from './notifications';
import { publishNow } from './outbox';

const MAX_ROLES = 50;

/* ---------------------------------- members --------------------------------- */

export async function listMembers(
  ctx: AuthedContext,
  crewId: ObjectId,
  query: { cursor?: string; q?: string; roleId?: string },
  limit = 50,
): Promise<{ items: CrewMember[]; nextCursor: string | null }> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const filter: Record<string, unknown> = { crewId, status: 'active' };
  if (query.roleId) filter.roleIds = ObjectId.createFromHexString(query.roleId);
  if (query.q) {
    const term = query.q.trim().toLowerCase().slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await ctx.cols.users
      .find({ $or: [{ usernameLower: { $regex: `^${term}` } }, { displayName: { $regex: term, $options: 'i' } }], status: 'active' }, { projection: { _id: 1 } })
      .limit(200)
      .toArray();
    filter.$or = [{ userId: { $in: users.map((u) => u._id) } }, { nickname: { $regex: term, $options: 'i' } }];
  }
  const c = decodeCursor(query.cursor, isDateIdCursor);
  if (c) {
    const at = new Date(c.t);
    filter.$and = [{ $or: [{ joinedAt: { $gt: at } }, { joinedAt: at, _id: { $gt: ObjectId.createFromHexString(c.id) } }] }];
  }
  const members = await ctx.cols.crewMembers.find(filter).sort({ joinedAt: 1, _id: 1 }).limit(limit).toArray();
  const users = await loadUserSummaries(ctx.cols.users, members.map((m) => m.userId));
  const items = members
    .map((m) => {
      const u = users.get(m.userId.toHexString());
      return u ? toCrewMember(m, u, access.crew) : null;
    })
    .filter((x): x is CrewMember => Boolean(x));
  const last = members[members.length - 1];
  return { items, nextCursor: members.length === limit && last ? encodeCursor({ t: last.joinedAt.getTime(), id: last._id.toHexString() }) : null };
}

export async function updateMember(
  ctx: AuthedContext,
  crewId: ObjectId,
  targetUserId: ObjectId,
  input: { roleIds?: string[]; nickname?: string | null; accentColor?: string | null },
): Promise<CrewMember> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const target = await ctx.cols.crewMembers.findOne({ crewId, userId: targetUserId, status: 'active' });
  if (!target) throw notFound('Member');
  const self = targetUserId.equals(ctx.actor.userId);
  const roles = access.roles.map(toRoleLike);
  const targetLike = toMemberLike(target, access.crew);
  const set: Record<string, unknown> = { updatedAt: ctx.now };

  if (input.nickname !== undefined || input.accentColor !== undefined) {
    if (!self) {
      requirePermission(access, 'MODERATE_MEMBERS');
      if (!canModerateMember(access.memberLike, targetLike, roles)) throw forbidden('You cannot edit this member.');
    }
    if (input.nickname !== undefined) set.nickname = input.nickname ?? null;
    if (input.accentColor !== undefined) set.accentColor = input.accentColor ?? null;
  }

  if (input.roleIds !== undefined) {
    requirePermission(access, 'MANAGE_ROLES');
    const requested = new Set(input.roleIds);
    const current = new Set(target.roleIds.map((r) => r.toHexString()));
    const changed = [...new Set([...requested, ...current])].filter((id) => requested.has(id) !== current.has(id));
    for (const roleId of changed) {
      const role = access.roles.find((r) => r._id.toHexString() === roleId);
      if (!role || role.isDefault) throw badRequest('Unknown or default role.');
      if (role.managed === 'owner') throw forbidden('The owner role can only change through ownership transfer.');
      if (!canManageRole(access.memberLike, toRoleLike(role), roles)) throw forbidden(`You cannot assign the role “${role.name}”.`);
    }
    if (!self && !canModerateMember(access.memberLike, targetLike, roles) && changed.length) throw forbidden('You cannot change roles of this member.');
    if (requested.size > 25) throw badRequest('Too many roles.');
    set.roleIds = [...requested].map((id) => ObjectId.createFromHexString(id));
    await audit(ctx, { action: 'member.roles_changed', targetType: 'user', targetId: targetUserId, crewId, metadata: { changed } });
  }

  await ctx.cols.crewMembers.updateOne({ _id: target._id }, { $set: set });
  const updated = (await ctx.cols.crewMembers.findOne({ _id: target._id }))!;
  const users = await loadUserSummaries(ctx.cols.users, [targetUserId]);
  return toCrewMember(updated, users.get(targetUserId.toHexString())!, access.crew);
}

/* --------------------------------- moderation -------------------------------- */

export async function moderate(ctx: AuthedContext, crewId: ObjectId, raw: CrewModerationInput): Promise<void> {
  const input = crewModerationSchema.parse(raw);
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const roles = access.roles.map(toRoleLike);
  const record = async (action: string, targetUserId: ObjectId | null, expiresAt: Date | null = null, targetRef: { type: string; id: ObjectId } | null = null) => {
    await ctx.cols.moderationActions.insertOne({
      _id: new ObjectId(),
      scope: 'crew',
      crewId,
      actorId: ctx.actor.userId,
      targetUserId,
      action,
      reason: input.reason ?? null,
      targetRef,
      expiresAt,
      createdAt: ctx.now,
    });
    await audit(ctx, { action: `moderation.${action}`, targetType: targetRef?.type ?? 'user', targetId: targetRef?.id ?? targetUserId, crewId });
  };

  if (input.action === 'delete_message') {
    if (!input.messageId) throw badRequest('messageId is required.');
    await moderatorDeleteMessage(ctx, ObjectId.createFromHexString(input.messageId), input.reason ?? null, crewId);
    return;
  }

  if (input.action === 'lock_channel' || input.action === 'unlock_channel') {
    if (!access.permissions.has('MANAGE_MESSAGES') && !access.permissions.has('EDIT_CHANNELS')) throw forbidden();
    if (!input.channelId) throw badRequest('channelId is required.');
    const channelId = ObjectId.createFromHexString(input.channelId);
    const res = await ctx.cols.crewChannels.updateOne({ _id: channelId, crewId, deletedAt: null }, { $set: { locked: input.action === 'lock_channel', updatedAt: ctx.now } });
    if (!res.matchedCount) throw notFound('Channel');
    await record(input.action, null, null, { type: 'channel', id: channelId });
    return;
  }

  if (!input.userId) throw badRequest('userId is required.');
  const targetUserId = ObjectId.createFromHexString(input.userId);

  if (input.action === 'unban') {
    requirePermission(access, 'MODERATE_MEMBERS');
    const res = await ctx.cols.crewMembers.updateOne({ crewId, userId: targetUserId, status: 'banned' }, { $set: { status: 'left', banReason: null, updatedAt: ctx.now } });
    if (!res.matchedCount) throw notFound('Ban');
    await record('unban', targetUserId);
    return;
  }

  const target = await ctx.cols.crewMembers.findOne({ crewId, userId: targetUserId, status: { $in: ['active', 'left', 'kicked'] } });
  if (!target) throw notFound('Member');
  requirePermission(access, 'MODERATE_MEMBERS');
  if (!canModerateMember(access.memberLike!, toMemberLike(target, access.crew), roles)) {
    throw forbidden('You cannot moderate a member with an equal or higher role, or the owner.');
  }

  switch (input.action) {
    case 'kick':
    case 'ban': {
      const wasActive = target.status === 'active';
      await ctx.cols.crewMembers.updateOne(
        { _id: target._id },
        { $set: { status: input.action === 'ban' ? 'banned' : 'kicked', roleIds: [], banReason: input.action === 'ban' ? (input.reason ?? null) : null, updatedAt: ctx.now } },
      );
      if (wasActive) await ctx.cols.crews.updateOne({ _id: crewId, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
      if (input.action === 'ban' && input.deleteRecentMessages) {
        const since = new Date(ctx.now.getTime() - 24 * 3600_000);
        await ctx.cols.messages.updateMany(
          { crewId, senderId: targetUserId, createdAt: { $gte: since }, deletedAt: null },
          { $set: { deletedAt: ctx.now, deletedBy: ctx.actor.userId, content: '', attachments: [], embeds: [], updatedAt: ctx.now, moderation: { flagged: true, removedByModerator: true, reason: input.reason ?? null } } },
        );
      }
      await record(input.action, targetUserId);
      await publishNow(ctx, [
        {
          channel: realtimeChannels.user(targetUserId.toHexString()),
          name: 'crew.membership',
          payload: { type: 'crew.membership', crewId: crewId.toHexString(), status: input.action === 'ban' ? 'banned' : 'removed' },
        },
      ]);
      return;
    }
    case 'timeout': {
      const minutes = input.durationMinutes ?? 60;
      const until = new Date(ctx.now.getTime() + minutes * 60_000);
      await ctx.cols.crewMembers.updateOne({ _id: target._id }, { $set: { timeoutUntil: until, updatedAt: ctx.now } });
      await record('timeout', targetUserId, until);
      await notify(ctx, {
        userId: targetUserId,
        type: 'moderator_announcement',
        crewId,
        title: `You were timed out in ${access.crew.name}`,
        body: input.reason ?? `Until ${until.toISOString()}`,
        link: `/c/${access.crew.slug}`,
      });
      return;
    }
    case 'remove_timeout':
      await ctx.cols.crewMembers.updateOne({ _id: target._id }, { $set: { timeoutUntil: null, updatedAt: ctx.now } });
      await record('remove_timeout', targetUserId);
      return;
    case 'warn':
      await record('warn', targetUserId);
      await notify(ctx, {
        userId: targetUserId,
        type: 'moderator_announcement',
        crewId,
        title: `Warning from the ${access.crew.name} moderators`,
        body: input.reason ?? null,
        link: `/c/${access.crew.slug}`,
      });
      return;
    default:
      throw badRequest('Unsupported action.');
  }
}

export async function moderationLog(ctx: AuthedContext, crewId: ObjectId, cursor: string | undefined, limit = 50) {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  if (!access.permissions.has('MODERATE_MEMBERS') && !access.permissions.has('VIEW_AUDIT_LOG')) throw forbidden();
  const c = decodeCursor(cursor, isDateIdCursor);
  const filter: Record<string, unknown> = { crewId };
  if (c) filter.$or = [{ createdAt: { $lt: new Date(c.t) } }, { createdAt: new Date(c.t), _id: { $lt: ObjectId.createFromHexString(c.id) } }];
  const docs = await ctx.cols.moderationActions.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
  const users = await loadUserSummaries(ctx.cols.users, docs.flatMap((d) => [d.actorId, d.targetUserId]));
  const items: ModerationActionDto[] = docs.map((d) => ({
    id: d._id.toHexString(),
    scope: d.scope,
    crewId: d.crewId?.toHexString() ?? null,
    action: d.action as ModerationActionDto['action'],
    actor: users.get(d.actorId.toHexString()) ?? null,
    target: d.targetUserId ? (users.get(d.targetUserId.toHexString()) ?? null) : null,
    reason: d.reason,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));
  const last = docs[docs.length - 1];
  return { items, nextCursor: docs.length === limit && last ? encodeCursor({ t: last.createdAt.getTime(), id: last._id.toHexString() }) : null };
}

export async function listBans(ctx: AuthedContext, crewId: ObjectId): Promise<CrewMember[]> {
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'MODERATE_MEMBERS');
  const bans = await ctx.cols.crewMembers.find({ crewId, status: 'banned' }).sort({ updatedAt: -1 }).limit(500).toArray();
  const users = await ctx.cols.users.find({ _id: { $in: bans.map((b) => b.userId) } }, { projection: USER_SUMMARY_PROJECTION }).toArray();
  const byId = new Map(users.map((u) => [u._id.toHexString(), toUserSummary(u as UserSummaryDoc)]));
  return bans.filter((b) => byId.has(b.userId.toHexString())).map((b) => toCrewMember(b, byId.get(b.userId.toHexString())!, access.crew));
}

/* ----------------------------------- roles ---------------------------------- */

export async function listRoles(ctx: AuthedContext, crewId: ObjectId): Promise<CrewRole[]> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  return access.roles.map(toCrewRole);
}

function nextPositionBelow(access: CrewAccess): number {
  const ceiling = access.isOwner ? 950 : highestPosition(access.memberLike!, access.roles.map(toRoleLike)) - 1;
  const taken = new Set(access.roles.map((r) => r.position));
  let pos = Math.min(ceiling, 450);
  while (taken.has(pos) && pos > 1) pos--;
  return Math.max(1, pos);
}

export async function createRole(ctx: AuthedContext, crewId: ObjectId, raw: z.input<typeof roleCreateSchema>): Promise<CrewRole> {
  const input = roleCreateSchema.parse(raw);
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'MANAGE_ROLES');
  if (access.roles.length >= MAX_ROLES) throw conflict(`A crew can have up to ${MAX_ROLES} roles.`);
  if (!canGrantPermissions(access.memberLike!, access.roles.map(toRoleLike), input.permissions)) throw forbidden('You cannot grant permissions you do not have.');
  const role: CrewRoleDoc = {
    _id: new ObjectId(),
    crewId,
    name: input.name,
    color: input.color ?? null,
    badge: input.badge ?? null,
    position: nextPositionBelow(access),
    permissions: [...new Set(input.permissions)] as CrewPermission[],
    managed: null,
    mentionable: input.mentionable,
    hoist: input.hoist,
    isDefault: false,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.cols.crewRoles.insertOne(role);
  await audit(ctx, { action: 'role.created', targetType: 'role', targetId: role._id, crewId, metadata: { permissions: role.permissions } });
  return toCrewRole(role);
}

export async function updateRole(ctx: AuthedContext, crewId: ObjectId, roleId: ObjectId, raw: z.input<typeof roleUpdateSchema>): Promise<CrewRole> {
  const input = roleUpdateSchema.parse(raw);
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'MANAGE_ROLES');
  const role = access.roles.find((r) => r._id.equals(roleId));
  if (!role) throw notFound('Role');
  const roles = access.roles.map(toRoleLike);
  // The default (@everyone) role is editable by anyone with MANAGE_ROLES (it sits at the bottom).
  if (!role.isDefault && !canManageRole(access.memberLike!, toRoleLike(role), roles)) throw forbidden('You cannot edit this role.');
  if (role.managed === 'owner') throw forbidden('The owner role cannot be edited.');
  const set: Partial<CrewRoleDoc> = { updatedAt: ctx.now };
  if (input.name !== undefined) set.name = input.name;
  if (input.color !== undefined) set.color = input.color ?? null;
  if (input.badge !== undefined) set.badge = input.badge ?? null;
  if (input.mentionable !== undefined) set.mentionable = input.mentionable;
  if (input.hoist !== undefined) set.hoist = input.hoist;
  if (input.permissions !== undefined) {
    const added = input.permissions.filter((p) => !role.permissions.includes(p));
    if (!canGrantPermissions(access.memberLike!, roles, added)) throw forbidden('You cannot grant permissions you do not have.');
    set.permissions = [...new Set(input.permissions)] as CrewPermission[];
  }
  await ctx.cols.crewRoles.updateOne({ _id: roleId }, { $set: set });
  await audit(ctx, { action: 'role.updated', targetType: 'role', targetId: roleId, crewId, metadata: { fields: Object.keys(input), permissions: set.permissions } });
  return toCrewRole({ ...role, ...set } as CrewRoleDoc);
}

export async function deleteRole(ctx: AuthedContext, crewId: ObjectId, roleId: ObjectId): Promise<void> {
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'MANAGE_ROLES');
  const role = access.roles.find((r) => r._id.equals(roleId));
  if (!role) throw notFound('Role');
  if (role.isDefault || role.managed === 'owner') throw forbidden('This role cannot be deleted.');
  if (!canManageRole(access.memberLike!, toRoleLike(role), access.roles.map(toRoleLike))) throw forbidden('You cannot delete this role.');
  await ctx.cols.crewRoles.deleteOne({ _id: roleId });
  await ctx.cols.crewMembers.updateMany({ crewId, roleIds: roleId }, { $pull: { roleIds: roleId } });
  await ctx.cols.crewChannels.updateMany({ crewId }, { $pull: { overwrites: { roleId } } });
  await audit(ctx, { action: 'role.deleted', targetType: 'role', targetId: roleId, crewId });
}

/** Reorders roles below the actor's highest role. `roleIds` is ordered highest → lowest. */
export async function reorderRoles(ctx: AuthedContext, crewId: ObjectId, roleIds: string[]): Promise<CrewRole[]> {
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'MANAGE_ROLES');
  const roles = access.roles.map(toRoleLike);
  const movable = roleIds.map((id) => {
    const role = access.roles.find((r) => r._id.toHexString() === id);
    if (!role) throw notFound('Role');
    if (role.isDefault || role.managed === 'owner') throw badRequest('Owner and default roles have fixed positions.');
    if (!canManageRole(access.memberLike!, toRoleLike(role), roles)) throw forbidden(`You cannot move “${role.name}”.`);
    return role;
  });
  const ceiling = access.isOwner ? 950 : highestPosition(access.memberLike!, roles) - 1;
  const step = Math.max(1, Math.floor(ceiling / (movable.length + 1)));
  await ctx.cols.crewRoles.bulkWrite(
    movable.map((role, i) => ({ updateOne: { filter: { _id: role._id }, update: { $set: { position: ceiling - i * step, updatedAt: ctx.now } } } })),
  );
  await audit(ctx, { action: 'role.reordered', targetType: 'crew', targetId: crewId, crewId });
  return (await ctx.cols.crewRoles.find({ crewId }).sort({ position: -1 }).toArray()).map(toCrewRole);
}
