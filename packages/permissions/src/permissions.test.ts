import { describe, expect, it } from 'vitest';
import {
  canGrantPermissions,
  canManageRole,
  canModerateMember,
  computeBasePermissions,
  computeChannelPermissions,
  type MemberLike,
  platformCan,
  type RoleLike,
} from './index';

const roles: RoleLike[] = [
  { id: 'owner', position: 1000, permissions: ['ADMINISTRATOR'], isDefault: false, managed: 'owner' },
  { id: 'admin', position: 900, permissions: ['ADMINISTRATOR'], isDefault: false, managed: 'administrator' },
  {
    id: 'mod',
    position: 500,
    permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_MESSAGES', 'MODERATE_MEMBERS', 'MANAGE_ROLES'],
    isDefault: false,
    managed: 'moderator',
  },
  { id: 'helper', position: 200, permissions: ['VIEW_CHANNEL'], isDefault: false, managed: null },
  {
    id: 'everyone',
    position: 0,
    permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'ADD_REACTIONS'],
    isDefault: true,
    managed: 'member',
  },
];

const owner: MemberLike = { userId: 'o', roleIds: ['owner'], isOwner: true };
const admin: MemberLike = { userId: 'a', roleIds: ['admin'], isOwner: false };
const mod: MemberLike = { userId: 'm', roleIds: ['mod'], isOwner: false };
const member: MemberLike = { userId: 'u', roleIds: [], isOwner: false };
const helper: MemberLike = { userId: 'h', roleIds: ['helper'], isOwner: false };

describe('base permissions', () => {
  it('gives owners and administrators everything', () => {
    expect(computeBasePermissions(owner, roles).has('MANAGE_CREW')).toBe(true);
    expect(computeBasePermissions(admin, roles).has('MANAGE_THEMES')).toBe(true);
  });

  it('gives members the default role permissions only', () => {
    const perms = computeBasePermissions(member, roles);
    expect(perms.has('SEND_MESSAGES')).toBe(true);
    expect(perms.has('MANAGE_MESSAGES')).toBe(false);
  });

  it('revokes posting while timed out', () => {
    const future = new Date(Date.now() + 60_000);
    const perms = computeBasePermissions({ ...member, timeoutUntil: future }, roles);
    expect(perms.has('SEND_MESSAGES')).toBe(false);
    expect(perms.has('VIEW_CHANNEL')).toBe(true);
  });
});

describe('channel permissions', () => {
  it('hides private channels via @everyone deny and re-allows a role', () => {
    const channel = {
      type: 'text' as const,
      locked: false,
      overwrites: [
        { roleId: 'everyone', allow: [], deny: ['VIEW_CHANNEL' as const] },
        { roleId: 'helper', allow: ['VIEW_CHANNEL' as const, 'SEND_MESSAGES' as const], deny: [] },
      ],
    };
    expect(computeChannelPermissions(member, roles, channel).size).toBe(0);
    const helperPerms = computeChannelPermissions(helper, roles, channel);
    expect(helperPerms.has('VIEW_CHANNEL')).toBe(true);
    expect(helperPerms.has('SEND_MESSAGES')).toBe(true);
    expect(computeChannelPermissions(owner, roles, channel).has('VIEW_CHANNEL')).toBe(true);
  });

  it('locks channels for regular members but not for message managers', () => {
    const channel = { type: 'text' as const, locked: true, overwrites: [] };
    expect(computeChannelPermissions(member, roles, channel).has('SEND_MESSAGES')).toBe(false);
    expect(computeChannelPermissions(mod, roles, channel).has('SEND_MESSAGES')).toBe(true);
  });

  it('announcement-style read-only overwrite', () => {
    const channel = {
      type: 'announcement' as const,
      locked: false,
      overwrites: [{ roleId: 'everyone', allow: [], deny: ['SEND_MESSAGES' as const] }],
    };
    expect(computeChannelPermissions(member, roles, channel).has('SEND_MESSAGES')).toBe(false);
    expect(computeChannelPermissions(member, roles, channel).has('VIEW_CHANNEL')).toBe(true);
  });
});

describe('hierarchy', () => {
  it('never allows acting on the owner', () => {
    expect(canModerateMember(admin, owner, roles)).toBe(false);
    expect(canModerateMember(mod, owner, roles)).toBe(false);
  });

  it('requires outranking the target', () => {
    expect(canModerateMember(mod, member, roles)).toBe(true);
    expect(canModerateMember(member, mod, roles)).toBe(false);
    expect(canModerateMember(mod, admin, roles)).toBe(false);
    expect(canModerateMember(mod, mod, roles)).toBe(false);
  });

  it('limits role management to lower roles and never the owner role', () => {
    expect(canManageRole(mod, roles[3]!, roles)).toBe(true);
    expect(canManageRole(mod, roles[1]!, roles)).toBe(false);
    expect(canManageRole(admin, roles[0]!, roles)).toBe(false);
    expect(canManageRole(member, roles[3]!, roles)).toBe(false);
  });

  it('prevents granting permissions the actor does not hold', () => {
    expect(canGrantPermissions(mod, roles, ['MANAGE_MESSAGES'])).toBe(true);
    expect(canGrantPermissions(mod, roles, ['MANAGE_CREW'])).toBe(false);
    expect(canGrantPermissions(owner, roles, ['MANAGE_CREW'])).toBe(true);
  });
});

describe('platform roles', () => {
  it('applies least privilege', () => {
    expect(platformCan('user', 'view_admin')).toBe(false);
    expect(platformCan('support', 'suspend_users')).toBe(false);
    expect(platformCan('moderator', 'suspend_users')).toBe(true);
    expect(platformCan('moderator', 'manage_platform_roles')).toBe(false);
    expect(platformCan('admin', 'manage_platform_roles')).toBe(true);
  });
});
