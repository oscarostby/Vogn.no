import type { Id, ISODate } from './common';
import type { UserSummary } from './user';

export type ConversationKind = 'channel' | 'dm' | 'group_dm' | 'thread';
export type MessageType = 'default' | 'system' | 'build_share' | 'event_share';

export interface MessageAttachment {
  id: Id;
  kind: 'image' | 'video' | 'file';
  url: string;
  thumbnailUrl: string | null;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  me: boolean;
}

export interface MessageMentions {
  userIds: Id[];
  roleIds: Id[];
  everyone: boolean;
}

export interface ReplyPreview {
  id: Id;
  sender: UserSummary | null;
  preview: string;
  deleted: boolean;
}

export interface MessageEmbed {
  kind: 'vehicle' | 'event' | 'link';
  id: Id | null;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
}

export interface ChatMessage {
  id: Id;
  conversationId: Id;
  seq: number;
  sender: UserSummary | null;
  type: MessageType;
  content: string;
  mentions: MessageMentions;
  attachments: MessageAttachment[];
  embeds: MessageEmbed[];
  replyTo: ReplyPreview | null;
  thread: { id: Id; replyCount: number; lastReplyAt: ISODate | null } | null;
  reactions: ReactionSummary[];
  pinned: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
  editedAt: ISODate | null;
  deletedAt: ISODate | null;
  idempotencyKey: string | null;
}

export interface MessagePreview {
  id: Id;
  senderName: string | null;
  text: string;
  createdAt: ISODate;
}

export interface ConversationSummary {
  id: Id;
  kind: ConversationKind;
  title: string;
  crewId: Id | null;
  channelId: Id | null;
  parentConversationId: Id | null;
  members: UserSummary[];
  memberCount: number;
  lastMessage: MessagePreview | null;
  lastMessageAt: ISODate | null;
  lastSeq: number;
  lastReadSeq: number;
  unreadCount: number;
  mentionCount: number;
  muted: boolean;
  createdAt: ISODate;
}

export interface MessageSyncResult {
  messages: ChatMessage[];
  /** Messages edited/deleted/reacted after `updatedSince`. */
  updated: ChatMessage[];
  lastSeq: number;
  serverTime: ISODate;
}

/** Authoritative events published by the server on `conv:{conversationId}`. */
export type ConversationEvent =
  | { type: 'message.created'; message: ChatMessage }
  | { type: 'message.updated'; message: ChatMessage }
  | { type: 'message.deleted'; conversationId: Id; messageId: Id; seq: number; deletedAt: ISODate }
  | {
      type: 'reaction.updated';
      conversationId: Id;
      messageId: Id;
      emoji: string;
      userId: Id;
      op: 'add' | 'remove';
      count: number;
    }
  | { type: 'pin.updated'; conversationId: Id; messageId: Id; pinned: boolean }
  | { type: 'thread.updated'; conversationId: Id; messageId: Id; threadId: Id; replyCount: number };

/** Events published by the server on `user:{userId}`. */
export type UserEvent =
  | { type: 'notification.created'; notificationId: Id }
  | {
      type: 'conversation.activity';
      conversationId: Id;
      crewId: Id | null;
      lastSeq: number;
      lastMessageAt: ISODate;
      mention: boolean;
      senderId: Id;
    }
  | { type: 'conversation.created'; conversationId: Id }
  | { type: 'read.updated'; conversationId: Id; lastReadSeq: number }
  | { type: 'crew.membership'; crewId: Id; status: 'joined' | 'removed' | 'banned' | 'approved' }
  | { type: 'session.revoked' };

/** Ephemeral client events on `conv:{conversationId}:typing`. */
export interface TypingSignal {
  userId: Id;
  displayName: string;
  typing: boolean;
}

export interface RealtimeTokenResponse {
  /** Ably TokenRequest (signed, no secret) or null when realtime is not configured. */
  tokenRequest: Record<string, unknown> | null;
  clientId: Id;
  channels: string[];
  configured: boolean;
}

export const realtimeChannels = {
  conversation: (conversationId: string) => `conv:${conversationId}`,
  typing: (conversationId: string) => `conv:${conversationId}:typing`,
  user: (userId: string) => `user:${userId}`,
  crewPresence: (crewId: string) => `crew:${crewId}:presence`,
} as const;
