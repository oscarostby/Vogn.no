import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { leaveConversation } from '@/server/services/conversations';

export const POST = route<{ id: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  await leaveConversation(authed(ctx), oid(params.id, 'Conversation'));
  return { left: true };
});
