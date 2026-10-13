import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { applyThemePreset } from '@/server/services/themes';
export const POST = route({ auth: 'required', body: z.object({ presetId: z.string(), mode: z.enum(['full', 'style']) }) }, async ({ ctx, params, body }) => applyThemePreset(authed(ctx), oid(params.crewId), body.presetId, body.mode));
