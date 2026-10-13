import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { revokeInvite } from '@/server/services/crew-invites';

export const DELETE = route<{ crewId: string; inviteId: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await revokeInvite(authed(ctx), oid(params.crewId, 'Crew'), oid(params.inviteId, 'Invitation'));
  return { revoked: true };
});
