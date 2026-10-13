import 'server-only';
import type { AdminStats, ReportDto } from '@vogn/types';
import { decodeCursor, dateIdCursorFilter, isDateIdCursor, nextDateIdCursor, type ReportDoc } from '@vogn/database';
import type { ObjectId } from 'mongodb';
import type { AuthedContext } from '../context';
import { requireActive } from '../context';
import { badRequest, forbidden, notFound } from '../errors';
import { toUserSummary } from '../mappers';
import { audit } from './audit';

export function requireStaff(ctx: AuthedContext) {
  requireActive(ctx);
  if (!['admin', 'moderator'].includes(ctx.actor.platformRole)) throw forbidden();
}

export async function adminStats(ctx: AuthedContext): Promise<AdminStats> {
  requireStaff(ctx);
  const day = new Date(Date.now() - 86400_000), week = new Date(Date.now() - 7 * 86400_000);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const [users, active, fresh, suspended, crews, activeCrews, messagesDay, messagesWeek, pending, reports, media] = await Promise.all([
    ctx.cols.users.countDocuments({ status: { $ne: 'deleted' } }), ctx.cols.users.countDocuments({ lastActiveAt: { $gte: week }, status: { $ne: 'deleted' } }),
    ctx.cols.users.countDocuments({ createdAt: { $gte: today }, status: { $ne: 'deleted' } }), ctx.cols.users.countDocuments({ status: 'suspended' }),
    ctx.cols.crews.countDocuments({ deletedAt: null }), ctx.cols.crews.countDocuments({ deletedAt: null, updatedAt: { $gte: week } }),
    ctx.cols.messages.countDocuments({ createdAt: { $gte: day }, deletedAt: null }), ctx.cols.messages.countDocuments({ createdAt: { $gte: week }, deletedAt: null }),
    ctx.cols.verificationRequests.countDocuments({ status: { $in: ['pending_review', 'in_review'] } }), ctx.cols.reports.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
    ctx.cols.mediaAssets.aggregate<{ assets: number; bytes: number }>([{ $match: { status: 'ready' } }, { $group: { _id: null, assets: { $sum: 1 }, bytes: { $sum: '$bytes' } } }]).toArray(),
  ]);
  return { users: { total: users, active7d: active, newToday: fresh, suspended }, crews: { total: crews, active7d: activeCrews }, messages: { last24h: messagesDay, last7d: messagesWeek }, verification: { pending }, reports: { open: reports }, media: { assets: media[0]?.assets ?? 0, bytes: media[0]?.bytes ?? 0 }, generatedAt: ctx.now.toISOString() };
}

async function mapReport(ctx: AuthedContext, doc: ReportDoc): Promise<ReportDto> {
  const reporter = await ctx.cols.users.findOne({ _id: doc.reporterId, status: { $ne: 'deleted' } });
  return { id: doc._id.toHexString(), target: { type: doc.targetType, id: doc.targetId.toHexString() }, reason: doc.reason, details: doc.details, status: doc.status, crewId: doc.crewId?.toHexString() ?? null,
    reporter: reporter ? toUserSummary(reporter) : null, context: { excerpt: doc.excerpt, authorId: doc.targetUserId?.toHexString() ?? null }, createdAt: doc.createdAt.toISOString(), resolvedAt: doc.resolvedAt?.toISOString() ?? null, resolution: doc.resolution };
}

export async function adminReports(ctx: AuthedContext, status: ReportDoc['status'], cursor?: string) {
  requireStaff(ctx);
  const docs = await ctx.cols.reports.find({ status, ...dateIdCursorFilter('createdAt', decodeCursor(cursor, isDateIdCursor)) }).sort({ createdAt: -1, _id: -1 }).limit(30).toArray();
  return { items: await Promise.all(docs.map((doc) => mapReport(ctx, doc))), nextCursor: nextDateIdCursor(docs, 30, (doc) => doc.createdAt) };
}

export async function resolveReport(ctx: AuthedContext, id: ObjectId, input: { status: 'reviewing' | 'actioned' | 'dismissed'; resolution?: string | null; removeContent?: boolean }) {
  requireStaff(ctx);
  if (input.removeContent) throw badRequest('Remove content through its moderation controls before resolving this report.');
  const doc = await ctx.cols.reports.findOneAndUpdate({ _id: id }, { $set: { status: input.status, resolution: input.resolution ?? null, assignedTo: ctx.actor.userId, updatedAt: ctx.now,
    resolvedAt: input.status === 'reviewing' ? null : ctx.now, resolvedBy: input.status === 'reviewing' ? null : ctx.actor.userId } }, { returnDocument: 'after' });
  if (!doc) throw notFound('Report');
  await audit(ctx, { action: 'report.reviewed', targetType: 'report', targetId: id, crewId: doc.crewId, metadata: { status: input.status } });
  return mapReport(ctx, doc);
}
