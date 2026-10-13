import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { blockUser, unblockUser } from '@/server/services/connections';

export const POST = route<{ id: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await blockUser(authed(ctx), oid(params.id, 'User'));
  return { blocked: true };
});

export const DELETE = route<{ id: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await unblockUser(authed(ctx), oid(params.id, 'User'));
  return { blocked: false };
});
