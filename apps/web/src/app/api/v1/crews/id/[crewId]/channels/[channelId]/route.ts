import { channelUpdateSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteChannel, updateChannel } from '@/server/services/crew-channels';

type P = { crewId: string; channelId: string };

export const PATCH = route({ auth: 'required', body: channelUpdateSchema }, async ({ ctx, params, body }) => {
  const p = params as P;
  return updateChannel(authed(ctx), oid(p.crewId, 'Crew'), oid(p.channelId, 'Channel'), body);
});

export const DELETE = route<P>({ auth: 'required' }, async ({ ctx, params }) => {
  await deleteChannel(authed(ctx), oid(params.crewId, 'Crew'), oid(params.channelId, 'Channel'));
  return { deleted: true };
});
