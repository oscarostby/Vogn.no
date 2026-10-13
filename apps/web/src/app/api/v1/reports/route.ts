import { reportCreateSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { createReport } from '@/server/services/reports';

export const POST = route({ auth: 'required', body: reportCreateSchema, rateLimit: RATE_LIMITS.report }, async ({ ctx, body }) => created(await createReport(authed(ctx), body)));
