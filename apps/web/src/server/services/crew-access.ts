import 'server-only';
import type { CrewChannelDoc, CrewDoc, CrewMemberDoc, CrewRoleDoc } from '@vogn/database';
import {
  computeBasePermissions,
  computeChannelPermissions,
  type MemberLike,
  type PermissionSet,
  type RoleLike,
} from '@vogn/permissions';
import type { CrewPermission } from '@vogn/types';
import type { ObjectId } from 'mongodb';
import type { ServiceContext } from '../context';
import { forbidden, notFound } from '../errors';

export interface CrewAccess {
  crew: CrewDoc;
  /** Active membership of the actor (null when not a member). */
  member: CrewMemberDoc | null;
  /** Raw membership row regardless of status (banned/left/kicked). */
  membership: CrewMemberDoc | null;
  roles: CrewRoleDoc[];
  memberLike: MemberLike | null;
  permissions: PermissionSet;
  isOwner: boolean;
  /** Whether the crew's existence/profile may be shown to the actor. */
  canView: boolean;
}

const EMPTY: PermissionSet = new Set<CrewPermission>();

export function toRoleLike(role: CrewRoleDoc): RoleLike {
  return { id: role._id.toHexString(), position: role.position, permissions: role.permissions, isDefault: role.isDefault, managed: role.managed };
}

export function toMemberLike(member: CrewMemberDoc, crew: CrewDoc): MemberLike {
  return {
    userId: member.userId.toHexString(),
    roleIds: member.roleIds.map((r) => r.toHexString()),
    isOwner: crew.ownerId.equals(member.userId),
    timeoutUntil: member.timeoutUntil,
  };
}

export async function loadCrew(ctx: ServiceContext, crewId: ObjectId): Promise<CrewDoc> {
  const crew = await ctx.cols.crews.findOne({ _id: crewId, deletedAt: null });
  if (!crew) throw notFound('Crew');
  return crew;
}

export async function getCrewAccess(ctx: ServiceContext, crewOrId: ObjectId | CrewDoc): Promise<CrewAccess> {
  const crew = 'slug' in crewOrId ? crewOrId : await loadCrew(ctx, crewOrId);
  const [membership, roles] = await Promise.all([
    ctx.actor ? ctx.cols.crewMembers.findOne({ crewId: crew._id, userId: ctx.actor.userId }) : Promise.resolve(null),
    ctx.cols.crewRoles.find({ crewId: crew._id }).sort({ position: -1 }).toArray(),
  ]);
  const member = membership?.status === 'active' ? membership : null;
  const memberLike = member ? toMemberLike(member, crew) : null;
  const roleLikes = roles.map(toRoleLike);
  const permissions = memberLike ? computeBasePermissions(memberLike, roleLikes, ctx.now) : EMPTY;
  const canView = crew.visibility !== 'hidden' || Boolean(member);
  return {
    crew,
    member,
    membership,
    roles,
    memberLike,
    permissions,
    isOwner: Boolean(ctx.actor && crew.ownerId.equals(ctx.actor.userId)),
    canView,
  };
}

/** Resolves access and hides hidden crews from non-members (NOT_FOUND, not FORBIDDEN). */
export async function getVisibleCrewAccess(ctx: ServiceContext, crewOrId: ObjectId | CrewDoc): Promise<CrewAccess> {
  const access = await getCrewAccess(ctx, crewOrId);
  if (!access.canView) throw notFound('Crew');
  return access;
}

export function requireMember(access: CrewAccess): asserts access is CrewAccess & { member: CrewMemberDoc; memberLike: MemberLike } {
  if (!access.member || !access.memberLike) throw access.canView ? forbidden('Join this crew first.') : notFound('Crew');
}

export function requirePermission(access: CrewAccess, permission: CrewPermission): void {
  requireMember(access);
  if (!access.permissions.has(permission)) throw forbidden();
}

export function channelPermissions(access: CrewAccess, channel: Pick<CrewChannelDoc, 'type' | 'locked' | 'overwrites'>): PermissionSet {
  if (!access.memberLike) return EMPTY;
  return computeChannelPermissions(
    access.memberLike,
    access.roles.map(toRoleLike),
    {
      type: channel.type,
      locked: channel.locked,
      overwrites: channel.overwrites.map((o) => ({ roleId: o.roleId.toHexString(), allow: o.allow, deny: o.deny })),
    },
    new Date(),
  );
}

/** Whether a channel is readable by non-members (public crews only expose announcement/showcase previews). */
export function isPublicPreviewChannel(crew: CrewDoc, channel: CrewChannelDoc, defaultRoleId: ObjectId): boolean {
  if (crew.visibility !== 'public') return false;
  if (!['announcement', 'showcase'].includes(channel.type)) return false;
  const everyone = channel.overwrites.find((o) => o.roleId.equals(defaultRoleId));
  return !everyone?.deny.includes('VIEW_CHANNEL');
}
