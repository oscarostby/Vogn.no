import { messageHistoryQuery, messageSendSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { listMessages, sendMessage } from '@/server/services/messages';

type P = { id: string };

export const GET = route({ auth: 'required', query: messageHistoryQuery }, async ({ ctx, params, query }) =>
  listMessages(ctx, oid((params as P).id, 'Conversation'), query),
);

export const POST = route({ auth: 'required', body: messageSendSchema, rateLimit: RATE_LIMITS.messageSend }, async ({ ctx, params, body }) =>
  created(await sendMessage(authed(ctx), oid((params as P).id, 'Conversation'), body)),
);
