import { realtimeTokenSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { createRealtimeToken } from '@/server/services/realtime';

export const POST = route({ auth: 'required', body: realtimeTokenSchema, rateLimit: RATE_LIMITS.typing }, async ({ ctx, body }) =>
  createRealtimeToken(authed(ctx), body),
);
