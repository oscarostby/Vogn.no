import { route } from '@/server/http/route';
import { isConfigured } from '@/server/env';
import { sendEventReminders } from '@/server/services/events';
import { processDueOutbox } from '@/server/services/outbox';

export const maxDuration = 60;
export const GET = route({ auth: 'cron' }, async ({ ctx }) => {
  const outbox = isConfigured('realtime') ? await processDueOutbox(ctx, 100) : { attempted: 0, delivered: 0 };
  const reminders = await sendEventReminders(ctx);
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const stale = await ctx.cols.mediaAssets.find({ provider: 'mongo-test', attachedTo: null, createdAt: { $lt: cutoff }, status: 'deleted' }).limit(200).toArray();
  if (stale.length) await ctx.db.collection('privateTestMedia').deleteMany({ _id: { $in: stale.map((d) => d._id) } });
  return { outbox, reminders, removedTestImages: stale.length };
});
