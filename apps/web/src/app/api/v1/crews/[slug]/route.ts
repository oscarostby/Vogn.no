import { route } from '@/server/http/route';
import { getCrewBySlug } from '@/server/services/crews';

export const GET = route<{ slug: string }>({ auth: 'optional' }, async ({ ctx, params }) => getCrewBySlug(ctx, params.slug));
