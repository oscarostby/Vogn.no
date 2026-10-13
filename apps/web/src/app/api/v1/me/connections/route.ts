import { z } from 'zod';
import { authed } from '@/server/http/params';
import { paginated, route } from '@/server/http/route';
import { listConnections } from '@/server/services/connections';

const query = z.object({
  status: z.enum(['friends', 'incoming', 'outgoing', 'followers', 'following']).default('friends'),
  cursor: z.string().max(512).optional(),
});

export const GET = route({ auth: 'required', query }, async ({ ctx, query: q }) => {
  const { items, nextCursor } = await listConnections(authed(ctx), q.status, q.cursor);
  return paginated(items, nextCursor);
});
