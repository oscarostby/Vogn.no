import { usernameAvailabilityQuery } from '@vogn/validation';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { checkUsername } from '@/server/services/users';

export const GET = route(
  { auth: 'required', allowWithoutProfile: true, query: usernameAvailabilityQuery, rateLimit: RATE_LIMITS.usernameCheck },
  async ({ ctx, query }) => checkUsername(ctx, query.username, ctx.actor?.userId),
);
