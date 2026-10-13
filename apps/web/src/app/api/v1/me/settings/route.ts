import { settingsUpdateSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';
import { updateSettings } from '@/server/services/users';

export const PATCH = route({ auth: 'required', body: settingsUpdateSchema }, async ({ ctx, body }) => updateSettings(authed(ctx), body));
