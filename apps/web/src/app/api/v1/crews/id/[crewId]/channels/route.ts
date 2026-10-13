import { channelCreateSchema, channelReorderSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { createChannel, listChannels, reorderChannels } from '@/server/services/crew-channels';

type P = { crewId: string };

export const GET = route<P>({ auth: 'required' }, async ({ ctx, params }) => listChannels(ctx, oid(params.crewId, 'Crew')));

export const POST = route({ auth: 'required', body: channelCreateSchema }, async ({ ctx, params, body }) =>
  created(await createChannel(authed(ctx), oid((params as P).crewId, 'Crew'), body)),
);

export const PUT = route({ auth: 'required', body: channelReorderSchema }, async ({ ctx, params, body }) =>
  reorderChannels(authed(ctx), oid((params as P).crewId, 'Crew'), body.items),
);
