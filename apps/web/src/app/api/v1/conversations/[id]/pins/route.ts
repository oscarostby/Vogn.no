import { oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { listPins } from '@/server/services/messages';

export const GET = route<{ id: string }>({ auth: 'required' }, async ({ ctx, params }) => listPins(ctx, oid(params.id, 'Conversation')));
