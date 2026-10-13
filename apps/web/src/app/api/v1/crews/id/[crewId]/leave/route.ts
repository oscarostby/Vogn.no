import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { leaveCrew } from '@/server/services/crews';

export const POST = route<{ crewId: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await leaveCrew(authed(ctx), oid(params.crewId, 'Crew'));
  return { left: true };
});
