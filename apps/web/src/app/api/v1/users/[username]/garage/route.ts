import { notFound } from '@/server/errors';
import { route } from '@/server/http/route';
import { resolveUsername } from '@/server/services/users';
import { listGarage } from '@/server/services/vehicles';

export const GET = route<{ username: string }>({ auth: 'optional' }, async ({ ctx, params }) => {
  const user = await resolveUsername(ctx, params.username);
  if (!user) throw notFound('Profile');
  return listGarage(ctx, user._id);
});
