import { buildDiscoverQuery } from '@vogn/validation';
import { paginated, route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { discoverBuilds } from '@/server/services/discover';

export const GET = route({ auth: 'optional', query: buildDiscoverQuery, rateLimit: RATE_LIMITS.search }, async ({ ctx, query }) => {
  const { items, nextCursor } = await discoverBuilds(ctx, query);
  return paginated(items, nextCursor);
});
