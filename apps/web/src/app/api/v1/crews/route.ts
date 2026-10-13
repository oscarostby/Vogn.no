import { crewCreateSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { listMyCrews } from '@/server/services/crew-channels';
import { createCrew } from '@/server/services/crews';

export const GET = route({ auth: 'required' }, async ({ ctx }) => listMyCrews(authed(ctx)));

export const POST = route({ auth: 'required', body: crewCreateSchema, rateLimit: RATE_LIMITS.crewCreate }, async ({ ctx, body }) =>
  created(await createCrew(authed(ctx), body)),
);
