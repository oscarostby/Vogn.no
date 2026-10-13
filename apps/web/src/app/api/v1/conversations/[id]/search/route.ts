import { messageSearchQuery } from '@vogn/validation';
import { oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { searchMessages } from '@/server/services/messages';

export const GET = route({ auth: 'required', query: messageSearchQuery, rateLimit: RATE_LIMITS.search }, async ({ ctx, params, query }) =>
  searchMessages(ctx, oid((params as { id: string }).id, 'Conversation'), query.q, query.beforeSeq, query.limit),
);
