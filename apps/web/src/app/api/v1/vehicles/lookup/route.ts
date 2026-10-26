import { vehicleLookupSchema } from '@vogn/validation';
import { requireActive } from '@/server/context';
import { route } from '@/server/http/route';
import { lookupNorwegianVehicle } from '@/server/integrations/vegvesen';
import { RATE_LIMITS } from '@/server/rate-limit';

export const runtime = 'nodejs';
export const POST = route({ auth: 'required', body: vehicleLookupSchema, rateLimit: RATE_LIMITS.vehicleLookup }, async ({ ctx, body }) => {
  requireActive(ctx);
  return lookupNorwegianVehicle(body.countryCode, body.registrationNumber);
});
