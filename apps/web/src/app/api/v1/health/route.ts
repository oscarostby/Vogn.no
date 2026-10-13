import { randomUUID } from 'node:crypto';
import { getDatabase } from '@/server/db';
import { integrationStatus } from '@/server/env';

/**
 * Public liveness/readiness probe. Reports which integrations are configured (names only, never values)
 * and whether the database answers a ping.
 */
export async function GET() {
  const started = Date.now();
  let database: { ok: boolean; latencyMs: number | null; error?: string } = { ok: false, latencyMs: null };
  try {
    const { db } = await getDatabase();
    await db.command({ ping: 1 });
    database = { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    database = { ok: false, latencyMs: null, error: error instanceof Error ? error.name : 'unknown' };
  }
  const integrations = integrationStatus().map(({ name, configured, required }) => ({ name, configured, required }));
  const ready = database.ok && integrations.filter((i) => i.required).every((i) => i.configured);
  return Response.json(
    { data: { status: ready ? 'ok' : 'degraded', database, integrations, time: new Date().toISOString() } },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': randomUUID() } },
  );
}
