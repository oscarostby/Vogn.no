import { profileUpdateSchema } from '@vogn/validation';
import { unauthenticated } from '@/server/errors';
import { getClerkUserInfo } from '@/server/integrations/clerk';
import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { getMe, updateProfile } from '@/server/services/users';

export const GET = route({ auth: 'required', allowWithoutProfile: true }, async ({ ctx, clerkUserId }) => {
  if (!clerkUserId) throw unauthenticated();
  return getMe(ctx, clerkUserId, () => getClerkUserInfo(clerkUserId));
});

export const PATCH = route({ auth: 'required', body: profileUpdateSchema }, async ({ ctx, body }) => updateProfile(authed(ctx), body));
