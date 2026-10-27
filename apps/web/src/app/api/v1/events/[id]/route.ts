import { eventUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteEvent, getEvent, updateEvent } from '@/server/services/events';

type P = { id: string };

export const GET = route<P>({ auth: 'required' }, async ({ ctx, params }) => getEvent(ctx, oid(params.id, 'Event')));

export const PATCH = route({ auth: 'required', body: eventUpdateSchema }, async ({ ctx, params, body }) =>
  updateEvent(authed(ctx), oid((params as P).id, 'Event'), body),
);

export const DELETE = route<P>({ auth: 'required' }, async ({ ctx, params }) => {
  await deleteEvent(authed(ctx), oid(params.id, 'Event'));
  return { deleted: true };
});
