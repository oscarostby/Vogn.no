import { mediaSignSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { createSignedUpload } from '@/server/services/media';

export const POST = route({ auth: 'required', body: mediaSignSchema, rateLimit: RATE_LIMITS.upload }, async ({ ctx, body }) =>
  createSignedUpload(authed(ctx), body),
);
