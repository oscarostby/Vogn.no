import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteMedia } from '@/server/services/media';

export const DELETE = route<{ id: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await deleteMedia(authed(ctx), oid(params.id, 'Media'));
  return { deleted: true };
});
