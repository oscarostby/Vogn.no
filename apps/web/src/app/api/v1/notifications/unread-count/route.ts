import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { unreadNotificationCount } from '@/server/services/notifications';

export const GET = route({ auth: 'required' }, async ({ ctx }) => ({ count: await unreadNotificationCount(authed(ctx)) }));
