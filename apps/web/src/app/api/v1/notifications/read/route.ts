import { notificationsReadSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { markNotificationsRead } from '@/server/services/notifications';

export const POST = route({ auth: 'required', body: notificationsReadSchema }, async ({ ctx, body }) => ({
  updated: await markNotificationsRead(authed(ctx), body),
}));
