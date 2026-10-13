import { onboardingSchema } from '@vogn/validation';
import { unauthenticated } from '@/server/errors';
import { getClerkUserInfo } from '@/server/integrations/clerk';
import { created, route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { completeOnboarding } from '@/server/services/users';

export const POST = route(
  { auth: 'required', allowWithoutProfile: true, body: onboardingSchema, rateLimit: RATE_LIMITS.usernameCheck },
  async ({ ctx, body, clerkUserId }) => {
    if (!clerkUserId) throw unauthenticated();
    const info = await getClerkUserInfo(clerkUserId);
    return created(await completeOnboarding(ctx, clerkUserId, body, info));
  },
);
