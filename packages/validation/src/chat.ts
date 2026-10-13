import { isValidReaction } from '@vogn/utils';
import { z } from 'zod';
import { idempotencyKey, isoDateTime, multiLine, objectId, optionalSingleLine } from './common';

export const MESSAGE_MAX_LENGTH = 4000;

export const messageSendSchema = z
  .object({
    content: multiLine(0, MESSAGE_MAX_LENGTH, 'validation.message'),
    attachmentIds: z.array(objectId).max(10, 'validation.tooMany').default([]),
    replyToId: objectId.nullable().optional(),
    idempotencyKey,
    embed: z
      .object({ kind: z.enum(['vehicle', 'event']), id: objectId })
      .nullable()
      .optional(),
  })
  .refine((m) => m.content.length > 0 || m.attachmentIds.length > 0 || !!m.embed, {
    message: 'validation.message.empty',
    path: ['content'],
  });
export type MessageSendInput = z.input<typeof messageSendSchema>;

export const messageEditSchema = z.object({
  content: multiLine(1, MESSAGE_MAX_LENGTH, 'validation.message'),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(40).refine(isValidReaction, 'validation.reaction'),
});

export const messageHistoryQuery = z.object({
  before: z.coerce.number().int().min(1).optional(),
  after: z.coerce.number().int().min(0).optional(),
  around: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const messageSyncQuery = z.object({
  afterSeq: z.coerce.number().int().min(0),
  updatedSince: isoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const messageSearchQuery = z.object({
  q: z.string().trim().min(2, 'validation.search.min').max(100),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  beforeSeq: z.coerce.number().int().min(1).optional(),
});

export const dmCreateSchema = z.object({
  userIds: z.array(objectId).min(1, 'validation.dm.min').max(9, 'validation.dm.max'),
  name: optionalSingleLine(60),
});
export type DmCreateInput = z.input<typeof dmCreateSchema>;

export const groupDmUpdateSchema = z.object({
  name: optionalSingleLine(60),
  addUserIds: z.array(objectId).max(9).optional(),
  removeUserId: objectId.optional(),
});

export const markReadSchema = z.object({ seq: z.number().int().min(0) });

export const conversationMuteSchema = z.object({
  muted: z.boolean(),
  until: z.iso.datetime({ offset: true }).nullable().optional(),
});

export const threadCreateSchema = z.object({ messageId: objectId });

export const realtimeTokenSchema = z.object({
  conversationIds: z.array(objectId).max(40).default([]),
  crewIds: z.array(objectId).max(10).default([]),
});
