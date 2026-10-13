import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { listAttendees } from '@/server/services/events';

export const GET = route<{ id: string }>({ auth: 'required' }, async ({ ctx, params }) => listAttendees(authed(ctx), oid(params.id, 'Event')));
