import { transferOwnershipSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { transferOwnership } from '@/server/services/crews';

export const POST = route({ auth: 'required', body: transferOwnershipSchema }, async ({ ctx, params, body }) =>
  transferOwnership(authed(ctx), oid((params as { crewId: string }).crewId, 'Crew'), oid(body.userId, 'Member'), body.confirmSlug),
);
