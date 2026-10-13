import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { setLike } from '@/server/services/vehicles';

type P = { id: string };

export const POST = route<P>({ auth: 'required', rateLimit: RATE_LIMITS.reaction }, async ({ ctx, params }) =>
  setLike(authed(ctx), oid(params.id, 'Vehicle'), true),
);

export const DELETE = route<P>({ auth: 'required', rateLimit: RATE_LIMITS.reaction }, async ({ ctx, params }) =>
  setLike(authed(ctx), oid(params.id, 'Vehicle'), false),
);
