import type { Id, ISODate } from './common';
import type { NotificationChannelPreferences, UserSummary } from './user';

export const NOTIFICATION_TYPES = [
  'direct_message',
  'mention',
  'reply',
  'reaction',
  'crew_invitation',
  'application_received',
  'membership_approved',
  'membership_rejected',
  'verification_decision',
  'event_update',
  'event_reminder',
  'moderator_announcement',
  'friend_request',
  'friend_accepted',
  'new_follower',
  'security_alert',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Which preference switch governs a notification type. */
export const NOTIFICATION_PREFERENCE_KEY: Record<NotificationType, keyof NotificationChannelPreferences> = {
  direct_message: 'directMessages',
  mention: 'mentions',
  reply: 'replies',
  reaction: 'reactions',
  crew_invitation: 'crewInvitations',
  application_received: 'membership',
  membership_approved: 'membership',
  membership_rejected: 'membership',
  verification_decision: 'verification',
  event_update: 'events',
  event_reminder: 'events',
  moderator_announcement: 'announcements',
  friend_request: 'social',
  friend_accepted: 'social',
  new_follower: 'social',
  security_alert: 'security',
};

export interface NotificationItem {
  id: Id;
  type: NotificationType;
  actor: UserSummary | null;
  title: string;
  body: string | null;
  link: string | null;
  crewId: Id | null;
  readAt: ISODate | null;
  createdAt: ISODate;
}

export interface CrewNotificationSettings {
  crewId: Id;
  level: 'all' | 'mentions' | 'nothing';
  mutedUntil: ISODate | null;
  suppressEveryone: boolean;
}
