import {
  CHANNEL_SCOPED_PERMISSIONS,
  CREW_PERMISSIONS,
  type ChannelScopedPermission,
  type ChannelType,
  type CrewPermission,
  type ManagedRole,
  type PermissionOverwrite,
} from '@vogn/types';

export const ALL_CREW_PERMISSIONS: readonly CrewPermission[] = CREW_PERMISSIONS;

export interface RoleLike {
  id: string;
  position: number;
  permissions: readonly CrewPermission[];
  isDefault: boolean;
  managed?: ManagedRole | null;
}

export interface MemberLike {
  userId: string;
  roleIds: readonly string[];
  isOwner: boolean;
  timeoutUntil?: Date | string | null;
}

export type PermissionSet = ReadonlySet<CrewPermission>;

const FULL: PermissionSet = new Set(ALL_CREW_PERMISSIONS);

/** Permissions removed while a member is timed out. */
const TIMEOUT_REVOKED: CrewPermission[] = [
  'SEND_MESSAGES',
  'ADD_REACTIONS',
  'UPLOAD_ATTACHMENTS',
  'MENTION_EVERYONE',
  'CONNECT_VOICE',
  'CREATE_INVITES',
];

export function isTimedOut(member: MemberLike, now: Date = new Date()): boolean {
  if (!member.timeoutUntil) return false;
  return new Date(member.timeoutUntil).getTime() > now.getTime();
}

function memberRoles(member: MemberLike, roles: readonly RoleLike[]): RoleLike[] {
  const ids = new Set(member.roleIds);
  return roles.filter((r) => r.isDefault || ids.has(r.id));
}

/** Crew-wide permissions (no channel context). */
export function computeBasePermissions(
  member: MemberLike,
  roles: readonly RoleLike[],
  now: Date = new Date(),
): PermissionSet {
  if (member.isOwner) return FULL;
  const set = new Set<CrewPermission>();
  for (const role of memberRoles(member, roles)) role.permissions.forEach((p) => set.add(p));
  if (set.has('ADMINISTRATOR')) return FULL;
  if (isTimedOut(member, now)) TIMEOUT_REVOKED.forEach((p) => set.delete(p));
  return set;
}

export interface ChannelContext {
  type: ChannelType;
  locked: boolean;
  overwrites: readonly PermissionOverwrite[];
}

/**
 * Channel-level permissions. Order (Discord-like, documented in docs/permissions.md):
 *  1. owner / ADMINISTRATOR → everything
 *  2. base permissions from roles
 *  3. default-role (@everyone) overwrite: deny, then allow
 *  4. member's role overwrites combined: deny-union, then allow-union (allow wins between roles)
 *  5. locked channels remove posting for anyone without MANAGE_MESSAGES
 *  6. timeouts remove posting permissions; no VIEW_CHANNEL → nothing
 */
export function computeChannelPermissions(
  member: MemberLike,
  roles: readonly RoleLike[],
  channel: ChannelContext,
  now: Date = new Date(),
): PermissionSet {
  const base = computeBasePermissions(member, roles, now);
  if (member.isOwner || base.has('ADMINISTRATOR')) return FULL;

  const set = new Set(base);
  const defaultRole = roles.find((r) => r.isDefault);
  const memberRoleIds = new Set(member.roleIds);

  const everyone = defaultRole ? channel.overwrites.find((o) => o.roleId === defaultRole.id) : undefined;
  if (everyone) {
    everyone.deny.forEach((p) => set.delete(p));
    everyone.allow.forEach((p) => set.add(p));
  }

  const roleOverwrites = channel.overwrites.filter(
    (o) => o.roleId !== defaultRole?.id && memberRoleIds.has(o.roleId),
  );
  const deny = new Set<ChannelScopedPermission>();
  const allow = new Set<ChannelScopedPermission>();
  roleOverwrites.forEach((o) => {
    o.deny.forEach((p) => deny.add(p));
    o.allow.forEach((p) => allow.add(p));
  });
  deny.forEach((p) => set.delete(p));
  allow.forEach((p) => set.add(p));

  if (channel.locked && !set.has('MANAGE_MESSAGES')) {
    set.delete('SEND_MESSAGES');
    set.delete('ADD_REACTIONS');
    set.delete('UPLOAD_ATTACHMENTS');
  }

  if (channel.type === 'category') {
    // Categories are containers; only visibility matters.
    return set.has('VIEW_CHANNEL') ? new Set<CrewPermission>(['VIEW_CHANNEL']) : new Set();
  }
  if (channel.type === 'voice') {
    set.delete('SEND_MESSAGES');
  } else {
    set.delete('CONNECT_VOICE');
  }

  if (isTimedOut(member, now)) TIMEOUT_REVOKED.forEach((p) => set.delete(p));
  if (!set.has('VIEW_CHANNEL')) return new Set();
  return set;
}

export function has(set: PermissionSet, permission: CrewPermission): boolean {
  return set.has(permission);
}

export function hasAny(set: PermissionSet, permissions: readonly CrewPermission[]): boolean {
  return permissions.some((p) => set.has(p));
}

/** Highest role position of a member; owners are above everyone. */
export function highestPosition(member: MemberLike, roles: readonly RoleLike[]): number {
  if (member.isOwner) return Number.POSITIVE_INFINITY;
  return memberRoles(member, roles).reduce((max, r) => Math.max(max, r.position), 0);
}

/**
 * Can `actor` act on `target` (kick, ban, timeout, change roles/nickname)?
 * Nobody can act on the owner; nobody can act on themselves through moderation; actor must outrank target.
 */
export function canModerateMember(actor: MemberLike, target: MemberLike, roles: readonly RoleLike[]): boolean {
  if (target.isOwner) return false;
  if (actor.userId === target.userId) return false;
  if (actor.isOwner) return true;
  return highestPosition(actor, roles) > highestPosition(target, roles);
}

/** Can `actor` edit/assign/delete `role`? Requires MANAGE_ROLES and outranking the role. */
export function canManageRole(actor: MemberLike, role: RoleLike, roles: readonly RoleLike[]): boolean {
  if (role.managed === 'owner') return false;
  if (actor.isOwner) return true;
  const perms = computeBasePermissions(actor, roles);
  if (!perms.has('MANAGE_ROLES')) return false;
  return highestPosition(actor, roles) > role.position;
}

/** Actors can only grant permissions they hold themselves (owners/administrators hold everything). */
export function canGrantPermissions(
  actor: MemberLike,
  roles: readonly RoleLike[],
  requested: readonly CrewPermission[],
): boolean {
  const perms = computeBasePermissions(actor, roles);
  return requested.every((p) => perms.has(p));
}

export function isChannelScoped(permission: string): permission is ChannelScopedPermission {
  return (CHANNEL_SCOPED_PERMISSIONS as readonly string[]).includes(permission);
}

export interface DefaultRoleTemplate {
  key: ManagedRole;
  name: string;
  color: string | null;
  position: number;
  permissions: CrewPermission[];
  isDefault: boolean;
  hoist: boolean;
}

const MEMBER_PERMISSIONS: CrewPermission[] = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'ADD_REACTIONS',
  'UPLOAD_ATTACHMENTS',
  'CREATE_INVITES',
  'CONNECT_VOICE',
];

const MODERATOR_PERMISSIONS: CrewPermission[] = [
  ...MEMBER_PERMISSIONS,
  'MANAGE_MESSAGES',
  'MENTION_EVERYONE',
  'MODERATE_MEMBERS',
  'APPROVE_APPLICANTS',
  'MANAGE_INVITES',
  'MANAGE_EVENTS',
  'MANAGE_VOICE',
  'VIEW_AUDIT_LOG',
];

/** Roles created with every crew. Positions leave room for custom roles in between. */
export const DEFAULT_ROLE_TEMPLATES: DefaultRoleTemplate[] = [
  {
    key: 'owner',
    name: 'Owner',
    color: '#C8FF5F',
    position: 1000,
    permissions: ['ADMINISTRATOR'],
    isDefault: false,
    hoist: true,
  },
  {
    key: 'administrator',
    name: 'Administrator',
    color: '#F2C14E',
    position: 900,
    permissions: ['ADMINISTRATOR'],
    isDefault: false,
    hoist: true,
  },
  {
    key: 'moderator',
    name: 'Moderator',
    color: '#6CB6FF',
    position: 500,
    permissions: MODERATOR_PERMISSIONS,
    isDefault: false,
    hoist: true,
  },
  {
    key: 'verified',
    name: 'Verified member',
    color: '#5FD38D',
    position: 100,
    permissions: MEMBER_PERMISSIONS,
    isDefault: false,
    hoist: false,
  },
  {
    key: 'member',
    name: 'Member',
    color: null,
    position: 0,
    permissions: MEMBER_PERMISSIONS,
    isDefault: true,
    hoist: false,
  },
];
