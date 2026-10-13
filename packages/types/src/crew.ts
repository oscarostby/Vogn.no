import type { Id, ISODate, MediaRef } from './common';
import type { UserSummary } from './user';

export const CREW_CATEGORIES = [
  'jdm',
  'european',
  'american_muscle',
  'supercars',
  'classic',
  'offroad',
  'motorsport',
  'drift',
  'detailing',
  'car_audio',
  'general',
  'custom',
] as const;
export type CrewCategory = (typeof CREW_CATEGORIES)[number];

/**
 * public       – anyone can view & join
 * application  – discoverable; joining requires an approved application
 * invite_only  – discoverable profile only; joining requires an invitation
 * hidden       – not discoverable; reachable only through invitations
 */
export const CREW_VISIBILITIES = ['public', 'application', 'invite_only', 'hidden'] as const;
export type CrewVisibility = (typeof CREW_VISIBILITIES)[number];

export const CREW_PERMISSIONS = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'ADD_REACTIONS',
  'MANAGE_MESSAGES',
  'UPLOAD_ATTACHMENTS',
  'MENTION_EVERYONE',
  'CREATE_CHANNELS',
  'EDIT_CHANNELS',
  'MANAGE_CREW',
  'MANAGE_INVITES',
  'CREATE_INVITES',
  'APPROVE_APPLICANTS',
  'MODERATE_MEMBERS',
  'MANAGE_ROLES',
  'MANAGE_THEMES',
  'MANAGE_VERIFICATION',
  'MANAGE_VOICE',
  'CONNECT_VOICE',
  'MANAGE_EVENTS',
  'VIEW_AUDIT_LOG',
  'ADMINISTRATOR',
] as const;
export type CrewPermission = (typeof CREW_PERMISSIONS)[number];

/** Permissions that can be scoped per channel through overwrites. */
export const CHANNEL_SCOPED_PERMISSIONS = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'ADD_REACTIONS',
  'MANAGE_MESSAGES',
  'UPLOAD_ATTACHMENTS',
  'MENTION_EVERYONE',
  'CONNECT_VOICE',
  'MANAGE_VOICE',
] as const satisfies readonly CrewPermission[];
export type ChannelScopedPermission = (typeof CHANNEL_SCOPED_PERMISSIONS)[number];

export type ManagedRole = 'owner' | 'administrator' | 'moderator' | 'member' | 'verified';

export interface RoleBadge {
  icon: string; // lucide icon name from the allowlist in @vogn/theme-engine
  style: 'solid' | 'outline' | 'glow';
}

export interface CrewRole {
  id: Id;
  crewId: Id;
  name: string;
  color: string | null;
  badge: RoleBadge | null;
  position: number;
  permissions: CrewPermission[];
  managed: ManagedRole | null;
  mentionable: boolean;
  hoist: boolean;
  isDefault: boolean;
}

export interface CrewRequirements {
  verifiedEmail: boolean;
  verifiedPhone: boolean;
  identityChecked: boolean;
  vehicleSpecsConfirmed: boolean;
  vehicleAccessReviewed: boolean;
  ownershipEvidenceReviewed: boolean;
  invitationOrReferral: boolean;
  /** Shown to applicants: why the crew asks for these. */
  explanation: string | null;
}

export const APPLICATION_QUESTION_KINDS = [
  'short_text',
  'long_text',
  'single_choice',
  'multi_choice',
  'country',
  'vehicle',
  'referral',
] as const;
export type ApplicationQuestionKind = (typeof APPLICATION_QUESTION_KINDS)[number];

export interface ApplicationQuestion {
  id: string;
  kind: ApplicationQuestionKind;
  label: string;
  help: string | null;
  required: boolean;
  options: string[];
}

export interface ApplicationForm {
  enabled: boolean;
  intro: string | null;
  questions: ApplicationQuestion[];
  /** Offer applicants the option to share verification outcomes (never raw evidence). */
  allowVerificationShare: boolean;
}

export interface CrewSummary {
  id: Id;
  slug: string;
  name: string;
  description: string | null;
  icon: MediaRef | null;
  banner: MediaRef | null;
  category: CrewCategory;
  tags: string[];
  region: string | null;
  country: string | null;
  language: string;
  visibility: CrewVisibility;
  memberCount: number;
  accentColor: string | null;
  createdAt: ISODate;
}

export type CrewMembershipStatus = 'none' | 'member' | 'pending_application' | 'banned' | 'timed_out';

export interface CrewViewerState {
  status: CrewMembershipStatus;
  isOwner: boolean;
  permissions: CrewPermission[];
  roleIds: Id[];
  nickname: string | null;
  timeoutUntil: ISODate | null;
  canJoinDirectly: boolean;
  canApply: boolean;
  missingRequirements: (keyof Omit<CrewRequirements, 'explanation'>)[];
}

export interface CrewDetail extends CrewSummary {
  ownerId: Id;
  rules: string[];
  requirements: CrewRequirements;
  applicationForm: ApplicationForm | null;
  viewer: CrewViewerState;
  publishedThemeVersion: number | null;
}

export interface CrewMember {
  userId: Id;
  user: UserSummary;
  nickname: string | null;
  accentColor: string | null;
  roleIds: Id[];
  joinedAt: ISODate;
  timeoutUntil: ISODate | null;
  isOwner: boolean;
}

export const CHANNEL_TYPES = [
  'text',
  'announcement',
  'media',
  'forum',
  'showcase',
  'event',
  'voice',
  'category',
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface PermissionOverwrite {
  /** Role id; the crew's default role id targets everyone. */
  roleId: Id;
  allow: ChannelScopedPermission[];
  deny: ChannelScopedPermission[];
}

export interface CrewChannel {
  id: Id;
  crewId: Id;
  conversationId: Id | null;
  name: string;
  type: ChannelType;
  parentId: Id | null;
  position: number;
  topic: string | null;
  icon: string | null;
  locked: boolean;
  slowmodeSeconds: number;
  overwrites: PermissionOverwrite[];
  lastMessageAt: ISODate | null;
  lastSeq: number;
  viewer: {
    canSend: boolean;
    canManage: boolean;
    canUpload: boolean;
    unreadCount: number;
    mentionCount: number;
    lastReadSeq: number;
    muted: boolean;
  };
}

export interface CrewInvitation {
  id: Id;
  code: string;
  crewId: Id;
  createdBy: UserSummary | null;
  maxUses: number | null;
  uses: number;
  expiresAt: ISODate | null;
  createdAt: ISODate;
}

export interface InvitePreview {
  code: string;
  crew: CrewSummary;
  inviter: UserSummary | null;
  expiresAt: ISODate | null;
  valid: boolean;
  alreadyMember: boolean;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

/** What an applicant explicitly agreed to share. Moderators see outcomes only. */
export interface VerificationShare {
  levels: string[];
  vehicleIds: Id[];
}

export interface CrewApplication {
  id: Id;
  crewId: Id;
  applicant: UserSummary;
  answers: { questionId: string; label: string; value: string | string[] }[];
  sharedVerification: VerificationShare | null;
  status: ApplicationStatus;
  createdAt: ISODate;
  reviewedAt: ISODate | null;
  reviewNote: string | null;
}

export interface CrewDiscoverFilters {
  q?: string;
  country?: string;
  region?: string;
  language?: string;
  category?: CrewCategory;
  brand?: string;
  size?: 'small' | 'medium' | 'large';
  availability?: 'open' | 'application' | 'invite';
  sort?: 'trending' | 'members' | 'new';
}
