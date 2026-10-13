import { roleCreateSchema, roleReorderSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { createRole, listRoles, reorderRoles } from '@/server/services/crew-members';

type P = { crewId: string };

export const GET = route<P>({ auth: 'required' }, async ({ ctx, params }) => listRoles(authed(ctx), oid(params.crewId, 'Crew')));

export const POST = route({ auth: 'required', body: roleCreateSchema }, async ({ ctx, params, body }) =>
  created(await createRole(authed(ctx), oid((params as P).crewId, 'Crew'), body)),
);

export const PUT = route({ auth: 'required', body: roleReorderSchema }, async ({ ctx, params, body }) =>
  reorderRoles(authed(ctx), oid((params as P).crewId, 'Crew'), body.roleIds),
);
