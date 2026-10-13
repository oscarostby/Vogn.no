import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { exportAccountData } from '@/server/services/account';

export const GET = route({ auth: 'required', rateLimit: RATE_LIMITS.export }, async ({ ctx, requestId }) => {
  const data = await exportAccountData(authed(ctx));
  const filename = `vogn-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
    },
  });
});
