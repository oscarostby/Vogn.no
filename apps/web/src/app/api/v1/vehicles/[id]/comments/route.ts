import { paginationQuery, vehicleCommentSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { created, paginated, route } from '@/server/http/route';
import { addComment, listComments } from '@/server/services/vehicles';

type P = { id: string };

export const GET = route({ auth: 'required', query: paginationQuery }, async ({ ctx, params, query }) => {
  const { items, nextCursor } = await listComments(ctx, oid((params as P).id, 'Vehicle'), query.cursor, Math.min(query.limit, 50));
  return paginated(items, nextCursor);
});

export const POST = route({ auth: 'required', body: vehicleCommentSchema }, async ({ ctx, params, body }) =>
  created(await addComment(authed(ctx), oid((params as P).id, 'Vehicle'), body.body)),
);
