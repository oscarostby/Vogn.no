import { reactionSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { setReaction } from '@/server/services/messages';

type P = { id: string; messageId: string };

export const POST = route({ auth: 'required', body: reactionSchema, rateLimit: RATE_LIMITS.reaction }, async ({ ctx, params, body }) => {
  const p = params as P;
  return setReaction(authed(ctx), oid(p.id, 'Conversation'), oid(p.messageId, 'Message'), body.emoji, true);
});

export const DELETE = route({ auth: 'required', body: reactionSchema, rateLimit: RATE_LIMITS.reaction }, async ({ ctx, params, body }) => {
  const p = params as P;
  return setReaction(authed(ctx), oid(p.id, 'Conversation'), oid(p.messageId, 'Message'), body.emoji, false);
});
