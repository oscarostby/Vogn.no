import { paginationQuery } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { paginated, route } from '@/server/http/route';
import { listNotifications } from '@/server/services/notifications';

export const GET = route({ auth: 'required', query: paginationQuery }, async ({ ctx, query }) => {
  const { items, nextCursor } = await listNotifications(authed(ctx), query.cursor, Math.min(query.limit, 50));
  return paginated(items, nextCursor);
});
