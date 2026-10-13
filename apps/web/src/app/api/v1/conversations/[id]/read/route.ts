import { markReadSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { markRead } from '@/server/services/messages';

export const POST = route({ auth: 'required', body: markReadSchema, rateLimit: RATE_LIMITS.reaction }, async ({ ctx, params, body }) => ({
  lastReadSeq: await markRead(authed(ctx), oid((params as { id: string }).id, 'Conversation'), body.seq),
}));
