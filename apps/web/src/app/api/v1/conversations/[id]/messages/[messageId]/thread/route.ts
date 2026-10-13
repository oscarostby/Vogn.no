import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { getConversationSummary } from '@/server/services/conversations';
import { openThread } from '@/server/services/messages';

export const POST = route<{ id: string; messageId: string }>({ auth: 'required' }, async ({ ctx, params }) => {
  const c = authed(ctx);
  const threadId = await openThread(c, oid(params.id, 'Conversation'), oid(params.messageId, 'Message'));
  return getConversationSummary(c, threadId);
});
