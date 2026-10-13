import { z } from 'zod';
import { authed } from '@/server/http/params';
import { paginated, route } from '@/server/http/route';
import { adminReports } from '@/server/services/admin';
export const GET = route({ auth: 'required', query: z.object({ status: z.enum(['open', 'reviewing', 'actioned', 'dismissed']).default('open'), cursor: z.string().max(200).optional() }) }, async ({ ctx, query }) => { const result = await adminReports(authed(ctx), query.status, query.cursor); return paginated(result.items, result.nextCursor); });
