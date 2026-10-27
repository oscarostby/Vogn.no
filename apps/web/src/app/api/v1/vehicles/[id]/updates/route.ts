import { buildUpdateCreateSchema, paginationQuery } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { created, paginated, route } from '@/server/http/route';
import { createBuildUpdate, listBuildUpdates } from '@/server/services/vehicles';

type P = { id: string };

export const GET = route({ auth: 'required', query: paginationQuery }, async ({ ctx, params, query }) => {
  const { items, nextCursor } = await listBuildUpdates(ctx, oid((params as P).id, 'Vehicle'), query.cursor, Math.min(query.limit, 50));
  return paginated(items, nextCursor);
});

export const POST = route({ auth: 'required', body: buildUpdateCreateSchema }, async ({ ctx, params, body }) =>
  created(await createBuildUpdate(authed(ctx), oid((params as P).id, 'Vehicle'), body)),
);
