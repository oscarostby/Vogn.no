import { decodeCursor, encodeCursor, isDateIdCursor } from '@vogn/database';
import type { AuditLogEntry } from '@vogn/types';
import { paginationQuery } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import { authed, oid } from '@/server/http/params';
import { paginated, route } from '@/server/http/route';
import { getCrewAccess, requirePermission } from '@/server/services/crew-access';

export const GET = route({ auth: 'required', query: paginationQuery }, async ({ ctx, params, query }) => {
  const c = authed(ctx);
  const crewId = oid((params as { crewId: string }).crewId, 'Crew');
  const access = await getCrewAccess(c, crewId);
  requirePermission(access, 'VIEW_AUDIT_LOG');
  const filter: Record<string, unknown> = { crewId };
  const cur = decodeCursor(query.cursor, isDateIdCursor);
  if (cur) filter.$or = [{ createdAt: { $lt: new Date(cur.t) } }, { createdAt: new Date(cur.t), _id: { $lt: ObjectId.createFromHexString(cur.id) } }];
  const limit = Math.min(query.limit, 100);
  const docs = await c.cols.auditLogs.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
  const items: AuditLogEntry[] = docs.map((d) => ({
    id: d._id.toHexString(),
    actorId: d.actorId?.toHexString() ?? null,
    action: d.action,
    targetType: d.targetType,
    targetId: d.targetId?.toHexString() ?? null,
    crewId: d.crewId?.toHexString() ?? null,
    metadata: d.metadata,
    createdAt: d.createdAt.toISOString(),
  }));
  const last = docs[docs.length - 1];
  return paginated(items, docs.length === limit && last ? encodeCursor({ t: last.createdAt.getTime(), id: last._id.toHexString() }) : null);
});
