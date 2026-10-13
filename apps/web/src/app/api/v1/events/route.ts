import { eventCreateSchema, eventListQuery } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { created, paginated, route } from '@/server/http/route';
import { createEvent, listEvents } from '@/server/services/events';

export const GET = route({ auth: 'optional', query: eventListQuery }, async ({ ctx, query }) => {
  const { items, nextCursor } = await listEvents(ctx, query);
  return paginated(items, nextCursor);
});

export const POST = route({ auth: 'required', body: eventCreateSchema }, async ({ ctx, body }) => created(await createEvent(authed(ctx), body)));
