import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { themeVersions } from '@/server/services/themes';
export const GET = route({ auth: 'required' }, async ({ ctx, params }) => themeVersions(authed(ctx), oid(params.crewId)));
