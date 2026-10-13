import 'server-only';
import type { ReportDoc } from '@vogn/database';
import { reportCreateSchema, type ReportCreateInput } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import { requireActive, type AuthedContext } from '../context';
import { notFound } from '../errors';
import { audit } from './audit';
import { assertConversationAccess } from './conversation-access';
import { getVisibleCrewAccess } from './crew-access';
import { getEvent } from './events';
import { getPublicProfile } from './users';
import { getVehicleDetail } from './vehicles';

/** Only report content the actor can read; store the smallest useful review snapshot. */
export async function createReport(ctx: AuthedContext, raw: ReportCreateInput): Promise<{ id: string }> {
  requireActive(ctx);
  const input = reportCreateSchema.parse(raw);
  const targetId = ObjectId.createFromHexString(input.targetId);
  let targetUserId: ObjectId | null = null;
  let crewId: ObjectId | null = null;
  let excerpt: string | null = null;
  switch (input.targetType) {
    case 'user': {
      const user = await ctx.cols.users.findOne({ _id: targetId, status: { $ne: 'deleted' } });
      if (!user) throw notFound('Profile');
      const profile = await getPublicProfile(ctx, user.username);
      targetUserId = targetId;
      excerpt = [profile.displayName, profile.bio].filter(Boolean).join('\n');
      break;
    }
    case 'crew': {
      const access = await getVisibleCrewAccess(ctx, targetId);
      targetUserId = access.crew.ownerId;
      excerpt = [access.crew.name, access.crew.description].filter(Boolean).join('\n');
      // Reports against crew management go to the platform, outside the crew's own moderators.
      break;
    }
    case 'vehicle': {
      const vehicle = await getVehicleDetail(ctx, targetId);
      targetUserId = ObjectId.createFromHexString(vehicle.owner.id);
      excerpt = `${vehicle.make} ${vehicle.model}`;
      break;
    }
    case 'comment': {
      const comment = await ctx.cols.vehicleComments.findOne({ _id: targetId, deletedAt: null });
      if (!comment) throw notFound('Comment');
      await getVehicleDetail(ctx, comment.vehicleId);
      targetUserId = comment.authorId;
      excerpt = comment.body;
      break;
    }
    case 'message': {
      const message = await ctx.cols.messages.findOne({ _id: targetId, deletedAt: null });
      if (!message) throw notFound('Message');
      const access = await assertConversationAccess(ctx, message.conversationId);
      targetUserId = message.senderId;
      crewId = access.crew?.crew._id ?? null;
      excerpt = message.content;
      break;
    }
    case 'event': {
      const event = await getEvent(ctx, targetId);
      targetUserId = event.organizer ? ObjectId.createFromHexString(event.organizer.id) : null;
      crewId = ObjectId.createFromHexString(event.crew.id);
      excerpt = [event.title, event.description].filter(Boolean).join('\n');
      break;
    }
    case 'theme': {
      const theme = await ctx.cols.themeMarketplace.findOne({ _id: targetId, status: 'approved' });
      if (!theme) throw notFound('Theme');
      targetUserId = theme.authorId;
      excerpt = [theme.name, theme.description].filter(Boolean).join('\n');
      break;
    }
  }
  const existing = await ctx.cols.reports.findOne({ reporterId: ctx.actor.userId, targetType: input.targetType, targetId, status: { $in: ['open', 'reviewing'] } }, { projection: { _id: 1 } });
  if (existing) return { id: existing._id.toHexString() };
  const doc: ReportDoc = {
    _id: new ObjectId(), reporterId: ctx.actor.userId, targetType: input.targetType, targetId, targetUserId, crewId,
    reason: input.reason, details: input.details ?? null, excerpt: excerpt?.slice(0, 1000) ?? null,
    status: 'open', assignedTo: null, resolvedAt: null, resolvedBy: null, resolution: null,
    scope: crewId ? 'crew' : 'platform', createdAt: ctx.now, updatedAt: ctx.now,
  };
  await ctx.cols.reports.insertOne(doc);
  await audit(ctx, { action: 'report.created', targetType: 'report', targetId: doc._id, crewId });
  return { id: doc._id.toHexString() };
}
