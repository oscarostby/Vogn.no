import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { studioTheme } from '@/server/services/themes';
export const GET = route({ auth: 'required' }, async ({ ctx, params }) => new Response(JSON.stringify((await studioTheme(authed(ctx), oid(params.crewId))).draft, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="vogn-theme.json"', 'Cache-Control': 'private, no-store' } }));
