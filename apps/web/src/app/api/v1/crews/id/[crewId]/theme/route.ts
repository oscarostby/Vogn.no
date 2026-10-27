import { oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { publishedTheme } from '@/server/services/themes';
export const GET = route({ auth: 'required' }, async ({ ctx, params }) => publishedTheme(ctx, oid(params.crewId)));
