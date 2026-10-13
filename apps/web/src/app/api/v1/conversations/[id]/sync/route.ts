import { messageSyncQuery } from '@vogn/validation';
import { oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { syncMessages } from '@/server/services/messages';

export const GET = route({ auth: 'required', query: messageSyncQuery }, async ({ ctx, params, query }) =>
  syncMessages(ctx, oid((params as { id: string }).id, 'Conversation'), query),
);
