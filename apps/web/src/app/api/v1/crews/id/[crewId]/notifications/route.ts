import { crewNotificationSettingsSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { updateCrewNotificationSettings } from '@/server/services/crews';

export const PATCH = route({ auth: 'required', body: crewNotificationSettingsSchema }, async ({ ctx, params, body }) => {
  await updateCrewNotificationSettings(authed(ctx), oid((params as { crewId: string }).crewId, 'Crew'), body);
  return { ok: true };
});
