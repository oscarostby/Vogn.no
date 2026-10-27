import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { RATE_LIMITS } from '@/server/rate-limit';
import { acceptInvite, previewInvite } from '@/server/services/crew-invites';

type P = { code: string };

export const GET = route<P>({ auth: 'required', rateLimit: RATE_LIMITS.invite }, async ({ ctx, params }) => previewInvite(ctx, params.code));

export const POST = route<P>({ auth: 'required', rateLimit: RATE_LIMITS.invite }, async ({ ctx, params }) => acceptInvite(authed(ctx), params.code));
