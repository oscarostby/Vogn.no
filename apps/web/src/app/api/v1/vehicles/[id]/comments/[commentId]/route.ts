import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteComment } from '@/server/services/vehicles';

export const DELETE = route<{ id: string; commentId: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await deleteComment(authed(ctx), oid(params.id, 'Vehicle'), oid(params.commentId, 'Comment'));
  return { deleted: true };
});
