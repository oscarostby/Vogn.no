import { buildUpdateUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteBuildUpdate, updateBuildUpdate } from '@/server/services/vehicles';

type P = { id: string; updateId: string };

export const PATCH = route({ auth: 'required', body: buildUpdateUpdateSchema }, async ({ ctx, params, body }) => {
  const p = params as P;
  return updateBuildUpdate(authed(ctx), oid(p.id, 'Vehicle'), oid(p.updateId, 'Build update'), body);
});

export const DELETE = route<P>({ auth: 'required' }, async ({ ctx, params }) => {
  await deleteBuildUpdate(authed(ctx), oid(params.id, 'Vehicle'), oid(params.updateId, 'Build update'));
  return { deleted: true };
});
