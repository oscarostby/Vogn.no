import { applicationSubmitSchema } from '@vogn/validation';
import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { created, paginated, route } from '@/server/http/route';
import { listApplications, submitApplication } from '@/server/services/crew-invites';

type P = { crewId: string };

export const GET = route(
  { auth: 'required', query: z.object({ status: z.enum(['pending', 'approved', 'rejected']).default('pending'), cursor: z.string().max(512).optional() }) },
  async ({ ctx, params, query }) => {
    const { items, nextCursor } = await listApplications(authed(ctx), oid((params as P).crewId, 'Crew'), query.status, query.cursor);
    return paginated(items, nextCursor);
  },
);

export const POST = route({ auth: 'required', body: applicationSubmitSchema }, async ({ ctx, params, body }) =>
  created(await submitApplication(authed(ctx), oid((params as P).crewId, 'Crew'), body)),
);
