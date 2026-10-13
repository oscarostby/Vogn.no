import 'server-only';
import { ObjectId } from 'mongodb';
import type { ServiceContext, Session } from '../context';
import { log } from '../log';

export interface AuditEntry {
  action: string;
  targetType?: string | null;
  targetId?: ObjectId | null;
  crewId?: ObjectId | null;
  metadata?: Record<string, unknown>;
}

/**
 * Records security-sensitive and administrative actions. Metadata must not contain secrets or raw
 * personal data (identifiers only).
 */
export async function audit(ctx: ServiceContext, entry: AuditEntry, session?: Session): Promise<void> {
  try {
    await ctx.cols.auditLogs.insertOne(
      {
        _id: new ObjectId(),
        actorId: ctx.actor?.userId ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        crewId: entry.crewId ?? null,
        metadata: entry.metadata ?? {},
        requestHash: ctx.requestHash,
        createdAt: ctx.now,
      },
      { session },
    );
  } catch (error) {
    if (session) throw error;
    log.error('audit log write failed', { action: entry.action, error });
  }
}
