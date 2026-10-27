import { oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { eventIcs } from '@/server/services/events';

export const GET = route<{ id: string }>({ auth: 'required' }, async ({ ctx, params, requestId }) => {
  const ics = await eventIcs(ctx, oid(params.id, 'Event'));
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="vogn-event-${params.id}.ics"`,
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
    },
  });
});
