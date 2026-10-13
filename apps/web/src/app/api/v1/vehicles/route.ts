import { vehicleCreateSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { createVehicle } from '@/server/services/vehicles';

export const POST = route({ auth: 'required', body: vehicleCreateSchema }, async ({ ctx, body }) =>
  created(await createVehicle(authed(ctx), body)),
);
