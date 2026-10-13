import { mediaCompleteSchema } from '@vogn/validation';
import { authed } from '@/server/http/params';
import { created, route } from '@/server/http/route';
import { completeUpload } from '@/server/services/media';

export const POST = route({ auth: 'required', body: mediaCompleteSchema }, async ({ ctx, body }) =>
  created(await completeUpload(authed(ctx), body)),
);
