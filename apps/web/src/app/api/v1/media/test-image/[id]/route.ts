import { authed, oid } from '@/server/http/params';
import { route } from '@/server/http/route';
import { readTestImage } from '@/server/services/test-media';

export const GET = route({ auth: 'required' }, async ({ ctx, params }) => readTestImage(authed(ctx), oid(params.id)));
