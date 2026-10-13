import { themeManifestSchema } from '@vogn/theme-engine';
import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { saveTheme, studioTheme } from '@/server/services/themes';
export const GET = route({ auth: 'required' }, async ({ ctx, params }) => studioTheme(authed(ctx), oid(params.crewId)));
export const PUT = route({ auth: 'required', body: z.object({ manifest: themeManifestSchema }) }, async ({ ctx, params, body }) => saveTheme(authed(ctx), oid(params.crewId), body.manifest));
