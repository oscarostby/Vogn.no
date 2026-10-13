import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { restoreTheme } from '@/server/services/themes';
export const POST = route({ auth: 'required', body: z.object({ publish: z.boolean().default(false) }) }, async ({ ctx, params, body }) => restoreTheme(authed(ctx), oid(params.crewId), z.coerce.number().int().positive().parse(params.version), body.publish));
