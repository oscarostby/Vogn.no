import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { paginated, route } from '@/server/http/route';
import { listMembers } from '@/server/services/crew-members';

const query = z.object({
  cursor: z.string().max(512).optional(),
  q: z.string().trim().max(40).optional(),
  roleId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
});

export const GET = route({ auth: 'required', query }, async ({ ctx, params, query: q }) => {
  const { items, nextCursor } = await listMembers(authed(ctx), oid((params as { crewId: string }).crewId, 'Crew'), q);
  return paginated(items, nextCursor);
});
