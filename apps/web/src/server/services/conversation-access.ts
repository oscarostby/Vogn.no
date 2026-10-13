import 'server-only';
import type { ConversationDoc, ConversationMemberDoc, CrewChannelDoc } from '@vogn/database';
import type { PermissionSet } from '@vogn/permissions';
import { ObjectId } from 'mongodb';
import type { ServiceContext } from '../context';
import { notFound } from '../errors';
import { type CrewAccess, channelPermissions, getCrewAccess } from './crew-access';

export interface ConversationAccess {
  conversation: ConversationDoc;
  /** For threads: the parent conversation that governs access. */
  root: ConversationDoc;
  channel: CrewChannelDoc | null;
  crew: CrewAccess | null;
  channelPerms: PermissionSet | null;
  member: ConversationMemberDoc | null;
  canView: boolean;
  canSend: boolean;
  canUpload: boolean;
  canReact: boolean;
  canManageMessages: boolean;
  canMentionEveryone: boolean;
  canPin: boolean;
  slowmodeSeconds: number;
  /** For 1:1 DMs: the other participant. */
  peerId: ObjectId | null;
  blocked: boolean;
}

async function resolve(ctx: ServiceContext, conversation: ConversationDoc, depth = 0): Promise<ConversationAccess> {
  if (conversation.kind === 'thread') {
    if (!conversation.parentConversationId || depth > 1) throw notFound('Conversation');
    const parent = await ctx.cols.conversations.findOne({ _id: conversation.parentConversationId });
    if (!parent) throw notFound('Conversation');
    const parentAccess = await resolve(ctx, parent, depth + 1);
    return { ...parentAccess, conversation, root: parent };
  }

  if (conversation.kind === 'channel') {
    if (!conversation.crewId || !conversation.channelId) throw notFound('Conversation');
    const [crew, channel] = await Promise.all([
      getCrewAccess(ctx, conversation.crewId),
      ctx.cols.crewChannels.findOne({ _id: conversation.channelId, deletedAt: null }),
    ]);
    if (!channel) throw notFound('Conversation');
    const perms = channelPermissions(crew, channel);
    const canView = perms.has('VIEW_CHANNEL');
    const manage = perms.has('MANAGE_MESSAGES');
    return {
      conversation,
      root: conversation,
      channel,
      crew,
      channelPerms: perms,
      member: null,
      canView,
      canSend: canView && perms.has('SEND_MESSAGES') && channel.type !== 'voice' && channel.type !== 'category',
      canUpload: canView && perms.has('UPLOAD_ATTACHMENTS'),
      canReact: canView && perms.has('ADD_REACTIONS'),
      canManageMessages: manage,
      canMentionEveryone: perms.has('MENTION_EVERYONE'),
      canPin: manage,
      slowmodeSeconds: manage ? 0 : channel.slowmodeSeconds,
      peerId: null,
      blocked: false,
    };
  }

  // DMs and group DMs: explicit membership.
  const member = ctx.actor
    ? await ctx.cols.conversationMembers.findOne({ conversationId: conversation._id, userId: ctx.actor.userId, leftAt: null })
    : null;
  let peerId: ObjectId | null = null;
  let blocked = false;
  if (member && conversation.kind === 'dm' && conversation.dmKey && ctx.actor) {
    const ids = conversation.dmKey.split(':');
    const peerHex = ids.find((id) => id !== ctx.actor!.userId.toHexString());
    if (peerHex) {
      peerId = ObjectId.createFromHexString(peerHex);
      blocked = Boolean(
        await ctx.cols.userBlocks.findOne(
          {
            $or: [
              { blockerId: ctx.actor.userId, blockedId: peerId },
              { blockerId: peerId, blockedId: ctx.actor.userId },
            ],
          },
          { projection: { _id: 1 } },
        ),
      );
    }
  }
  const canView = Boolean(member);
  const canSend = canView && !blocked && !ctx.actor?.suspended;
  return {
    conversation,
    root: conversation,
    channel: null,
    crew: null,
    channelPerms: null,
    member,
    canView,
    canSend,
    canUpload: canSend,
    canReact: canSend,
    canManageMessages: false,
    canMentionEveryone: false,
    canPin: canView,
    slowmodeSeconds: 0,
    peerId,
    blocked,
  };
}

/** Throws NOT_FOUND unless the actor can view the conversation. */
export async function assertConversationAccess(ctx: ServiceContext, conversationId: ObjectId): Promise<ConversationAccess> {
  const conversation = await ctx.cols.conversations.findOne({ _id: conversationId });
  if (!conversation) throw notFound('Conversation');
  const access = await resolve(ctx, conversation);
  if (!access.canView) throw notFound('Conversation');
  return access;
}

export async function getConversationAccess(ctx: ServiceContext, conversation: ConversationDoc): Promise<ConversationAccess> {
  return resolve(ctx, conversation);
}
