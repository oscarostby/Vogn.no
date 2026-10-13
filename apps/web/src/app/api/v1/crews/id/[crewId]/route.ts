import { crewUpdateSchema } from '@vogn/validation';
import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { deleteCrew, getCrewDetail, updateCrew } from '@/server/services/crews';

type P = { crewId: string };

export const GET = route<P>({ auth: 'optional' }, async ({ ctx, params }) => getCrewDetail(ctx, oid(params.crewId, 'Crew')));

export const PATCH = route({ auth: 'required', body: crewUpdateSchema }, async ({ ctx, params, body }) =>
  updateCrew(authed(ctx), oid((params as P).crewId, 'Crew'), body),
);

export const DELETE = route({ auth: 'required', body: z.object({ confirmSlug: z.string().max(40) }) }, async ({ ctx, params, body }) => {
  await deleteCrew(authed(ctx), oid((params as P).crewId, 'Crew'), body.confirmSlug);
  return { deleted: true };
});
