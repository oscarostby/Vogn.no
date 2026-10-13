import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { listBans } from '@/server/services/crew-members';

export const GET = route<{ crewId: string }>({ auth: 'required' }, async ({ ctx, params }) => listBans(authed(ctx), oid(params.crewId, 'Crew')));
