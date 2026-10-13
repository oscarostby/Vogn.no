import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { resolveReport } from '@/server/services/admin';
export const POST = route({ auth: 'required', body: z.object({ status: z.enum(['reviewing', 'actioned', 'dismissed']), resolution: z.string().max(2000).nullable().optional(), removeContent: z.boolean().optional() }) }, async ({ ctx, params, body }) => resolveReport(authed(ctx), oid(params.id), body));
