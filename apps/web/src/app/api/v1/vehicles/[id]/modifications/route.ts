import { modificationsSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { setModifications } from '@/server/services/vehicles';

export const PUT = route({ auth: 'required', body: modificationsSchema }, async ({ ctx, params, body }) =>
  setModifications(authed(ctx), oid((params as { id: string }).id, 'Vehicle'), body),
);
