import { vehicleGallerySchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { setGallery } from '@/server/services/vehicles';

export const PUT = route({ auth: 'required', body: vehicleGallerySchema }, async ({ ctx, params, body }) =>
  setGallery(authed(ctx), oid((params as { id: string }).id, 'Vehicle'), body.mediaIds),
);
