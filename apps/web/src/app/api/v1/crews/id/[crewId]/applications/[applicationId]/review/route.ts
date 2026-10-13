import { applicationReviewSchema } from '@vogn/validation';
import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { reviewApplication } from '@/server/services/crew-invites';

export const POST = route({ auth: 'required', body: applicationReviewSchema }, async ({ ctx, params, body }) => {
  const p = params as { crewId: string; applicationId: string };
  return reviewApplication(authed(ctx), oid(p.crewId, 'Crew'), oid(p.applicationId, 'Application'), body);
});
