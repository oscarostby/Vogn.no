import { dmCreateSchema } from '@vogn/validation';
import { z } from 'zod';
import { authed } from '@/server/http/params';
import { created, paginated, route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { createConversation, listConversations } from '@/server/services/conversations';

export const GET = route({ auth: 'required', query: z.object({ cursor: z.string().max(512).optional() }) }, async ({ ctx, query }) => {
  const { items, nextCursor } = await listConversations(authed(ctx), query.cursor);
  return paginated(items, nextCursor);
});

export const POST = route({ auth: 'required', body: dmCreateSchema, rateLimit: RATE_LIMITS.dmCreate }, async ({ ctx, body }) =>
  created(await createConversation(authed(ctx), body.userIds, body.name ?? null)),
);
