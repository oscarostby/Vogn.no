import { selfMemberUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { updateMember } from '@/server/services/crew-members';

export const PATCH = route({ auth: 'required', body: selfMemberUpdateSchema }, async ({ ctx, params, body }) => {
  const c = authed(ctx);
  return updateMember(c, oid((params as { crewId: string }).crewId, 'Crew'), c.actor.userId, body);
});
