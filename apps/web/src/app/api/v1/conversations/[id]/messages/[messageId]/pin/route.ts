import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { setPinned } from '@/server/services/messages';

type P = { id: string; messageId: string };

export const POST = route<P>({ auth: 'required' }, async ({ ctx, params }) =>
  setPinned(authed(ctx), oid(params.id, 'Conversation'), oid(params.messageId, 'Message'), true),
);

export const DELETE = route<P>({ auth: 'required' }, async ({ ctx, params }) =>
  setPinned(authed(ctx), oid(params.id, 'Conversation'), oid(params.messageId, 'Message'), false),
);
