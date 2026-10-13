import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { adminStats } from '@/server/services/admin';
export const GET = route({ auth: 'required' }, async ({ ctx }) => adminStats(authed(ctx)));
