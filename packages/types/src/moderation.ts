import type { Id, ISODate } from './common';
import type { UserSummary } from './user';

export const REPORT_TARGET_TYPES = ['message', 'user', 'crew', 'vehicle', 'comment', 'event', 'theme'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'violence',
  'sexual_content',
  'doxxing',
  'impersonation',
  'scam',
  'illegal',
  'self_harm',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

export interface ReportDto {
  id: Id;
  target: { type: ReportTargetType; id: Id };
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  crewId: Id | null;
  reporter: UserSummary | null;
  /** Minimal context for reviewers (e.g. the reported message text), never full private history. */
  context: { excerpt: string | null; authorId: Id | null } | null;
  createdAt: ISODate;
  resolvedAt: ISODate | null;
  resolution: string | null;
}

export const CREW_MODERATION_ACTIONS = [
  'kick',
  'ban',
  'unban',
  'timeout',
  'remove_timeout',
  'delete_message',
  'lock_channel',
  'unlock_channel',
  'warn',
] as const;
export const PLATFORM_MODERATION_ACTIONS = [
  'suspend',
  'unsuspend',
  'remove_content',
  'restore_content',
  'dismiss_report',
  'warn',
] as const;
export type CrewModerationAction = (typeof CREW_MODERATION_ACTIONS)[number];
export type PlatformModerationAction = (typeof PLATFORM_MODERATION_ACTIONS)[number];

export interface ModerationActionDto {
  id: Id;
  scope: 'crew' | 'platform';
  crewId: Id | null;
  action: CrewModerationAction | PlatformModerationAction;
  actor: UserSummary | null;
  target: UserSummary | null;
  reason: string | null;
  expiresAt: ISODate | null;
  createdAt: ISODate;
}

export interface AppealDto {
  id: Id;
  user: UserSummary;
  moderationActionId: Id;
  message: string;
  status: 'open' | 'upheld' | 'overturned';
  createdAt: ISODate;
  decidedAt: ISODate | null;
}

export interface AuditLogEntry {
  id: Id;
  actorId: Id | null;
  action: string;
  targetType: string | null;
  targetId: Id | null;
  crewId: Id | null;
  metadata: Record<string, unknown>;
  createdAt: ISODate;
}

export interface AdminStats {
  users: { total: number; active7d: number; newToday: number; suspended: number };
  crews: { total: number; active7d: number };
  messages: { last24h: number; last7d: number };
  verification: { pending: number };
  reports: { open: number };
  media: { assets: number; bytes: number };
  generatedAt: ISODate;
}

export interface ProviderStatus {
  name: string;
  configured: boolean;
  required: boolean;
  detail: string;
}
