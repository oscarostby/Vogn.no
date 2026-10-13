import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { acceptInvite } from '@/server/services/crew-invites';
import { joinCrew } from '@/server/services/crews';

export const POST = route(
  { auth: 'required', body: z.object({ inviteCode: z.string().max(32).optional() }), rateLimit: RATE_LIMITS.invite },
  async ({ ctx, params, body }) => {
    const c = authed(ctx);
    if (body.inviteCode) return acceptInvite(c, body.inviteCode);
    return joinCrew(c, oid((params as { crewId: string }).crewId, 'Crew'));
  },
);
