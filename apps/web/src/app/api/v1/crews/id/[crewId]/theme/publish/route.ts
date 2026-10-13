import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { publishTheme } from '@/server/services/themes';
export const POST = route({ auth: 'required', body: z.object({ note: z.string().max(500).optional() }) }, async ({ ctx, params, body }) => publishTheme(authed(ctx), oid(params.crewId), body.note));
