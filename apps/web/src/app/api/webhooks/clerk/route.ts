import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';
import { createContext } from '@/server/context';
import { getDatabase } from '@/server/db';
import { getEnv } from '@/server/env';
import { log } from '@/server/log';
import { handleProviderDeletion } from '@/server/services/account';
import { syncVerificationLevels } from '@/server/services/users';

/**
 * Clerk → VOGN sync (Svix-signed). Configure in Clerk Dashboard → Webhooks with events
 * `user.updated` and `user.deleted`, and set CLERK_WEBHOOK_SIGNING_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!getEnv().CLERK_WEBHOOK_SIGNING_SECRET) {
    return Response.json({ error: { code: 'CONFIG_MISSING', message: 'Webhook secret not configured.' } }, { status: 503 });
  }
  let event;
  try {
    event = await verifyWebhook(req);
  } catch {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Invalid webhook signature.' } }, { status: 400 });
  }

  const database = await getDatabase();
  const ctx = createContext(database, null);

  try {
    if (event.type === 'user.updated') {
      const data = event.data;
      const email = data.email_addresses.find((e) => e.id === data.primary_email_address_id) ?? data.email_addresses[0];
      const phone = data.phone_numbers.find((p) => p.id === data.primary_phone_number_id) ?? data.phone_numbers[0];
      const user = await database.cols.users.findOne({ clerkUserId: data.id }, { projection: { _id: 1 } });
      if (user) {
        await syncVerificationLevels(ctx, user._id, {
          emailVerified: email?.verification?.status === 'verified',
          phoneVerified: phone?.verification?.status === 'verified',
        });
      }
    } else if (event.type === 'user.deleted' && event.data.id) {
      await handleProviderDeletion(ctx, event.data.id);
    }
  } catch (error) {
    log.error('clerk webhook handling failed', { type: event.type, error });
    return Response.json({ error: { code: 'INTERNAL', message: 'Webhook processing failed.' } }, { status: 500 });
  }
  return Response.json({ data: { received: true } });
}
