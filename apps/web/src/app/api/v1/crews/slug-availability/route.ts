import { crewSlugSchema } from '@vogn/validation';
import { z } from 'zod';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { slugAvailable } from '@/server/services/crews';

export const GET = route({ auth: 'required', query: z.object({ slug: z.string().max(40) }), rateLimit: RATE_LIMITS.usernameCheck }, async ({ ctx, query }) => {
  const parsed = crewSlugSchema.safeParse(query.slug);
  if (!parsed.success) return { available: false, reason: parsed.error.issues[0]?.message ?? 'validation.slug.chars' };
  return { available: await slugAvailable(ctx, parsed.data), reason: null };
});
