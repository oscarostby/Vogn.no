import { groupDmUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { getConversationSummary, updateGroup } from '@/server/services/conversations';

type P = { id: string };

export const GET = route<P>({ auth: 'required' }, async ({ ctx, params }) => getConversationSummary(authed(ctx), oid(params.id, 'Conversation')));

export const PATCH = route({ auth: 'required', body: groupDmUpdateSchema }, async ({ ctx, params, body }) =>
  updateGroup(authed(ctx), oid((params as P).id, 'Conversation'), body),
);
