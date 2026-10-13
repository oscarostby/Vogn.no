import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { withdrawApplication } from '@/server/services/crew-invites';

export const DELETE = route<{ crewId: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await withdrawApplication(authed(ctx), oid(params.crewId, 'Crew'));
  return { withdrawn: true };
});
