import { inviteCreateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { createInvite, listInvites } from '@/server/services/crew-invites';

type P = { crewId: string };

export const GET = route<P>({ auth: 'required' }, async ({ ctx, params }) => listInvites(authed(ctx), oid(params.crewId, 'Crew')));

export const POST = route({ auth: 'required', body: inviteCreateSchema }, async ({ ctx, params, body }) =>
  created(await createInvite(authed(ctx), oid((params as P).crewId, 'Crew'), body)),
);
