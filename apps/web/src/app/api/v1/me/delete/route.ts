import { accountDeletionSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { deleteAccount } from '@/server/services/account';

export const POST = route({ auth: 'required', body: accountDeletionSchema, rateLimit: RATE_LIMITS.export }, async ({ ctx, body }) => {
  await deleteAccount(authed(ctx), body.confirmUsername, body.reason ?? null);
  return { deleted: true };
});
