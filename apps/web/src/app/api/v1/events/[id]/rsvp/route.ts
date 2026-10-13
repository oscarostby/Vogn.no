import { rsvpSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { rsvp } from '@/server/services/events';

export const POST = route({ auth: 'required', body: rsvpSchema }, async ({ ctx, params, body }) =>
  rsvp(authed(ctx), oid((params as { id: string }).id, 'Event'), body.status),
);
