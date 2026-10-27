import { crewDiscoverQuery } from '@vogn/validation';
import { paginated, route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { discoverCrews } from '@/server/services/crews';

export const GET = route({ auth: 'required', query: crewDiscoverQuery, rateLimit: RATE_LIMITS.search }, async ({ ctx, query }) => {
  const { items, nextCursor } = await discoverCrews(ctx, query);
  return paginated(items, nextCursor);
});
