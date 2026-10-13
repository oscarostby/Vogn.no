import { crewModerationSchema, paginationQuery } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { paginated, route } from '@/server/http/route';
import { moderate, moderationLog } from '@/server/services/crew-members';

type P = { crewId: string };

export const GET = route({ auth: 'required', query: paginationQuery }, async ({ ctx, params, query }) => {
  const { items, nextCursor } = await moderationLog(authed(ctx), oid((params as P).crewId, 'Crew'), query.cursor);
  return paginated(items, nextCursor);
});

export const POST = route({ auth: 'required', body: crewModerationSchema }, async ({ ctx, params, body }) => {
  await moderate(authed(ctx), oid((params as P).crewId, 'Crew'), body);
  return { ok: true };
});
