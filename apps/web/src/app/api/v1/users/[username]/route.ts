import { route } from '@/server/http/route';
import { getPublicProfile } from '@/server/services/users';

export const GET = route<{ username: string }>({ auth: 'required' }, async ({ ctx, params }) => getPublicProfile(ctx, params.username));
