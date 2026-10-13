import { roleUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteRole, updateRole } from '@/server/services/crew-members';

type P = { crewId: string; roleId: string };

export const PATCH = route({ auth: 'required', body: roleUpdateSchema }, async ({ ctx, params, body }) => {
  const p = params as P;
  return updateRole(authed(ctx), oid(p.crewId, 'Crew'), oid(p.roleId, 'Role'), body);
});

export const DELETE = route<P>({ auth: 'required' }, async ({ ctx, params }) => {
  await deleteRole(authed(ctx), oid(params.crewId, 'Crew'), oid(params.roleId, 'Role'));
  return { deleted: true };
});
