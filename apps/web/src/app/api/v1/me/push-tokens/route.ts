import { pushTokenSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { authed } from '@/server/http/params';
import { route } from '@/server/http/route';

export const POST = route({ auth: 'required', body: pushTokenSchema }, async ({ ctx, body }) => {
  const c = authed(ctx);
  // A device token belongs to whoever registered it last (handles account switching on one device).
  await c.cols.pushTokens.updateOne(
    { token: body.token },
    {
      $set: { userId: c.actor.userId, platform: body.platform, lastUsedAt: c.now, updatedAt: c.now },
      $setOnInsert: { _id: new ObjectId(), token: body.token, createdAt: c.now },
    },
    { upsert: true },
  );
  return { ok: true };
});

export const DELETE = route({ auth: 'required', body: z.object({ token: z.string().max(200) }) }, async ({ ctx, body }) => {
  const c = authed(ctx);
  await c.cols.pushTokens.deleteOne({ token: body.token, userId: c.actor.userId });
  return { ok: true };
});
