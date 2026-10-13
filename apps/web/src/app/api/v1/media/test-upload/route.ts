import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { testImageSchema, uploadTestImage } from '@/server/services/test-media';

export const POST = route({ auth: 'required', body: testImageSchema, rateLimit: RATE_LIMITS.upload, maxBodyBytes: 3 * 1024 * 1024 }, async ({ ctx, body }) => uploadTestImage(authed(ctx), body));
