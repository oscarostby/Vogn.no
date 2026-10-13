import { connectionActionSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { connectionAction } from '@/server/services/connections';

export const POST = route<{ id: string }, { action: 'request' | 'accept' | 'decline' | 'cancel' | 'remove' | 'follow' | 'unfollow' }>(
  { auth: 'required', body: connectionActionSchema, rateLimit: RATE_LIMITS.friendRequest },
  async ({ ctx, params, body }) => connectionAction(authed(ctx), oid(params.id, 'User'), body.action),
);
