import { memberUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { updateMember } from '@/server/services/crew-members';

export const PATCH = route({ auth: 'required', body: memberUpdateSchema }, async ({ ctx, params, body }) => {
  const p = params as { crewId: string; userId: string };
  return updateMember(authed(ctx), oid(p.crewId, 'Crew'), oid(p.userId, 'Member'), body);
});
