import { messageEditSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteMessage, editMessage } from '@/server/services/messages';

type P = { id: string; messageId: string };

export const PATCH = route({ auth: 'required', body: messageEditSchema }, async ({ ctx, params, body }) => {
  const p = params as P;
  return editMessage(authed(ctx), oid(p.id, 'Conversation'), oid(p.messageId, 'Message'), body.content);
});

export const DELETE = route<P>({ auth: 'required' }, async ({ ctx, params }) =>
  deleteMessage(authed(ctx), oid(params.id, 'Conversation'), oid(params.messageId, 'Message')),
);
