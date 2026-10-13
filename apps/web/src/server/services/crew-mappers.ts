import 'server-only';
import type { CrewChannelDoc, CrewDoc, CrewMemberDoc, CrewRoleDoc } from '@vogn/database';
import type { PermissionSet } from '@vogn/permissions';
import type {
  CrewChannel,
  CrewDetail,
  CrewMember,
  CrewRequirements,
  CrewRole,
  CrewViewerState,
  UserSummary,
} from '@vogn/types';
import { toCrewSummary } from '../mappers';

export function toCrewRole(role: CrewRoleDoc): CrewRole {
  return {
    id: role._id.toHexString(),
    crewId: role.crewId.toHexString(),
    name: role.name,
    color: role.color,
    badge: role.badge,
    position: role.position,
    permissions: role.permissions,
    managed: role.managed,
    mentionable: role.mentionable,
    hoist: role.hoist,
    isDefault: role.isDefault,
  };
}

export function toCrewMember(member: CrewMemberDoc, user: UserSummary, crew: CrewDoc): CrewMember {
  return {
    userId: member.userId.toHexString(),
    user,
    nickname: member.nickname,
    accentColor: member.accentColor,
    roleIds: member.roleIds.map((r) => r.toHexString()),
    joinedAt: member.joinedAt.toISOString(),
    timeoutUntil: member.timeoutUntil && member.timeoutUntil > new Date() ? member.timeoutUntil.toISOString() : null,
    isOwner: crew.ownerId.equals(member.userId),
  };
}

export function toCrewChannel(
  channel: CrewChannelDoc,
  perms: PermissionSet,
  extra: { lastSeq: number; lastMessageAt: Date | null; lastReadSeq: number; mentionCount: number; muted: boolean; showOverwrites: boolean },
): CrewChannel {
  return {
    id: channel._id.toHexString(),
    crewId: channel.crewId.toHexString(),
    conversationId: channel.conversationId?.toHexString() ?? null,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId?.toHexString() ?? null,
    position: channel.position,
    topic: channel.topic,
    icon: channel.icon,
    locked: channel.locked,
    slowmodeSeconds: channel.slowmodeSeconds,
    overwrites: extra.showOverwrites
      ? channel.overwrites.map((o) => ({ roleId: o.roleId.toHexString(), allow: o.allow, deny: o.deny }))
      : [],
    lastMessageAt: extra.lastMessageAt?.toISOString() ?? null,
    lastSeq: extra.lastSeq,
    viewer: {
      canSend: perms.has('SEND_MESSAGES'),
      canManage: perms.has('MANAGE_MESSAGES'),
      canUpload: perms.has('UPLOAD_ATTACHMENTS'),
      unreadCount: Math.max(0, extra.lastSeq - extra.lastReadSeq),
      mentionCount: extra.mentionCount,
      lastReadSeq: extra.lastReadSeq,
      muted: extra.muted,
    },
  };
}

export function toCrewDetail(crew: CrewDoc, viewer: CrewViewerState): CrewDetail {
  return {
    ...toCrewSummary(crew),
    ownerId: crew.ownerId.toHexString(),
    rules: crew.rules,
    requirements: crew.requirements,
    applicationForm: crew.applicationForm,
    viewer,
    publishedThemeVersion: crew.publishedThemeVersion,
  };
}

export const EMPTY_REQUIREMENTS: CrewRequirements = {
  verifiedEmail: false,
  verifiedPhone: false,
  identityChecked: false,
  vehicleSpecsConfirmed: false,
  vehicleAccessReviewed: false,
  ownershipEvidenceReviewed: false,
  invitationOrReferral: false,
  explanation: null,
};
