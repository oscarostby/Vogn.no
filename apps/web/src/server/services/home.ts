import 'server-only';
import type { HomeFeed } from '@vogn/api-client';
import type { AuthedContext } from '../context';
import { toVehicleSummary } from '../mappers';
import { listMyCrews } from './crew-channels';
import { listConversations } from './conversations';
import { discoverBuilds } from './discover';
import { upcomingCrewEvents } from './events';

/** Aggregated, meaningful home screen for signed-in users. */
export async function homeFeed(ctx: AuthedContext): Promise<HomeFeed> {
  const [crews, garage, builds, conversations, user] = await Promise.all([
    listMyCrews(ctx),
    ctx.cols.vehicles.find({ ownerId: ctx.actor.userId, deletedAt: null }).sort({ updatedAt: -1 }).limit(6).toArray(),
    discoverBuilds(ctx, { limit: 8 }),
    listConversations(ctx, undefined, 6),
    ctx.cols.users.findOne({ _id: ctx.actor.userId }, { projection: { avatar: 1 } }),
  ]);
  const crewIds = crews.map((c) => c.id);
  const { ObjectId } = await import('mongodb');
  const upcomingEvents = await upcomingCrewEvents(ctx, crewIds.map((id) => ObjectId.createFromHexString(id)), 5, true);
  return {
    crews,
    upcomingEvents,
    garage: garage.map(toVehicleSummary),
    builds: builds.items.filter((b) => b.owner.id !== ctx.actor.userId.toHexString()).slice(0, 6),
    conversations: conversations.items,
    onboarding: { hasAvatar: Boolean(user?.avatar), hasVehicle: garage.length > 0, hasCrew: crews.length > 0 },
  };
}
