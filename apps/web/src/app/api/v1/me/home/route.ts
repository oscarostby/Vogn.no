import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { homeFeed } from '@/server/services/home';

export const GET = route({ auth: 'required' }, async ({ ctx }) => homeFeed(authed(ctx)));
