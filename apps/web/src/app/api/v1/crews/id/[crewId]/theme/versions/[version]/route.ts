import { z } from 'zod';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { themeVersion } from '@/server/services/themes';
export const GET = route({ auth: 'required' }, async ({ ctx, params }) => themeVersion(authed(ctx), oid(params.crewId), z.coerce.number().int().positive().parse(params.version)));
