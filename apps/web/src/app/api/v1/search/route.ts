import { searchQuery } from '@vogn/validation';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { globalSearch } from '@/server/services/discover';

export const GET = route({ auth: 'optional', query: searchQuery, rateLimit: RATE_LIMITS.search }, async ({ ctx, query }) =>
  globalSearch(ctx, query.q, query.type, query.limit),
);
