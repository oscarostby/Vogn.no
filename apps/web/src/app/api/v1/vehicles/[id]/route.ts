import { vehicleUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteVehicle, getVehicleDetail, updateVehicle } from '@/server/services/vehicles';

type P = { id: string };

export const GET = route<P>({ auth: 'optional' }, async ({ ctx, params }) => getVehicleDetail(ctx, oid(params.id, 'Vehicle')));

export const PATCH = route({ auth: 'required', body: vehicleUpdateSchema }, async ({ ctx, params, body }) =>
  updateVehicle(authed(ctx), oid((params as P).id, 'Vehicle'), body),
);

export const DELETE = route<P>({ auth: 'required' }, async ({ ctx, params }) => {
  await deleteVehicle(authed(ctx), oid(params.id, 'Vehicle'));
  return { deleted: true };
});
