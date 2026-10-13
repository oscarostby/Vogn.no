import { conversationMuteSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { muteConversation } from '@/server/services/conversations';

export const POST = route({ auth: 'required', body: conversationMuteSchema }, async ({ ctx, params, body }) => ({
  muted: await muteConversation(authed(ctx), oid((params as { id: string }).id, 'Conversation'), body.muted, body.until),
}));
