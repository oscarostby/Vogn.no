import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { listBlocks } from '@/server/services/connections';

export const GET = route({ auth: 'required' }, async ({ ctx }) => listBlocks(authed(ctx)));
