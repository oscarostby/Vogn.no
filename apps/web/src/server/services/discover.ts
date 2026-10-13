import 'server-only';
import { decodeCursor, encodeCursor, isDateIdCursor, type VehicleDoc } from '@vogn/database';
import type { BuildFeedItem, BuildUpdate, CrewSummary, UserSummary, VehicleSummary } from '@vogn/types';
import { buildDiscoverQuery } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import type { z } from 'zod';
import type { ServiceContext } from '../context';
import { CREW_SUMMARY_PROJECTION, loadUserSummaries, toCrewSummary, toMediaRef, toUserSummary, toVehicleSummary, USER_SUMMARY_PROJECTION, type UserSummaryDoc } from '../mappers';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function blockedIds(ctx: ServiceContext): Promise<ObjectId[]> {
  if (!ctx.actor) return [];
  const rows = await ctx.cols.userBlocks
    .find({ $or: [{ blockerId: ctx.actor.userId }, { blockedId: ctx.actor.userId }] }, { projection: { blockerId: 1, blockedId: 1 } })
    .toArray();
  return rows.map((r) => (r.blockerId.equals(ctx.actor!.userId) ? r.blockedId : r.blockerId));
}

async function latestUpdates(ctx: ServiceContext, vehicleIds: ObjectId[]): Promise<Map<string, BuildUpdate>> {
  if (!vehicleIds.length) return new Map();
  const docs = await ctx.cols.vehicleBuildUpdates
    .aggregate<import('@vogn/database').BuildUpdateDoc>([
      { $match: { vehicleId: { $in: vehicleIds } } },
      { $sort: { occurredAt: -1 } },
      { $group: { _id: '$vehicleId', doc: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$doc' } },
    ])
    .toArray();
  return new Map(
    docs.map((u) => [
      u.vehicleId.toHexString(),
      {
        id: u._id.toHexString(),
        vehicleId: u.vehicleId.toHexString(),
        kind: u.kind,
        title: u.title,
        body: u.body,
        occurredAt: u.occurredAt.toISOString(),
        media: u.media.map((m) => toMediaRef(m)!),
        before: toMediaRef(u.before),
        after: toMediaRef(u.after),
        cost: null,
        createdAt: u.createdAt.toISOString(),
      },
    ]),
  );
}

export async function toBuildFeed(ctx: ServiceContext, vehicles: VehicleDoc[]): Promise<BuildFeedItem[]> {
  const [owners, updates] = await Promise.all([loadUserSummaries(ctx.cols.users, vehicles.map((v) => v.ownerId)), latestUpdates(ctx, vehicles.map((v) => v._id))]);
  return vehicles
    .filter((v) => owners.has(v.ownerId.toHexString()))
    .map((v) => ({ vehicle: toVehicleSummary(v), owner: owners.get(v.ownerId.toHexString())!, latestUpdate: updates.get(v._id.toHexString()) ?? null }));
}

/** Public builds feed (only `public` vehicles of active owners; blocked users excluded). */
export async function discoverBuilds(ctx: ServiceContext, raw: z.input<typeof buildDiscoverQuery>) {
  const q = buildDiscoverQuery.parse(raw);
  const filter: Record<string, unknown> = { visibility: 'public', deletedAt: null };
  const blocked = await blockedIds(ctx);
  if (blocked.length) filter.ownerId = { $nin: blocked };
  if (q.make) filter.makeLower = q.make.toLowerCase();
  if (q.model) filter.modelLower = { $regex: `^${escapeRegex(q.model.toLowerCase())}` };
  if (q.generation) filter.generation = { $regex: `^${escapeRegex(q.generation)}`, $options: 'i' };
  if (q.category) filter.modCategoryKeys = q.category.toLowerCase();
  if (q.country) filter.ownerCountry = q.country;
  const c = decodeCursor(q.cursor, isDateIdCursor);
  if (c) filter.$or = [{ updatedAt: { $lt: new Date(c.t) } }, { updatedAt: new Date(c.t), _id: { $lt: ObjectId.createFromHexString(c.id) } }];
  const docs = await ctx.cols.vehicles.find(filter).sort({ updatedAt: -1, _id: -1 }).limit(q.limit).toArray();
  // Exclude owners whose account is not active.
  const activeOwners = new Set(
    (await ctx.cols.users.find({ _id: { $in: docs.map((d) => d.ownerId) }, status: 'active' }, { projection: { _id: 1 } }).toArray()).map((u) => u._id.toHexString()),
  );
  const items = await toBuildFeed(ctx, docs.filter((d) => activeOwners.has(d.ownerId.toHexString())));
  const last = docs[docs.length - 1];
  return { items, nextCursor: docs.length === q.limit && last ? encodeCursor({ t: last.updatedAt.getTime(), id: last._id.toHexString() }) : null };
}

/** Global search across people (respecting profile visibility), discoverable crews and public builds. */
export async function globalSearch(ctx: ServiceContext, term: string, type: 'all' | 'users' | 'crews' | 'vehicles', limit: number) {
  const q = term.trim().slice(0, 80);
  const prefix = { $regex: `^${escapeRegex(q.toLowerCase())}` };
  const blocked = await blockedIds(ctx);
  const result: { users: UserSummary[]; crews: CrewSummary[]; vehicles: (VehicleSummary & { owner: UserSummary })[] } = { users: [], crews: [], vehicles: [] };

  if (type === 'all' || type === 'users') {
    const byPrefix = await ctx.cols.users
      .find({ usernameLower: prefix, status: 'active', _id: { $nin: blocked } }, { projection: USER_SUMMARY_PROJECTION })
      .limit(limit)
      .toArray();
    const byText =
      q.length >= 2
        ? await ctx.cols.users
            .find({ $text: { $search: q }, status: 'active', _id: { $nin: blocked } }, { projection: { ...USER_SUMMARY_PROJECTION, score: { $meta: 'textScore' } } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .toArray()
        : [];
    const merged = new Map<string, UserSummaryDoc>();
    [...byPrefix, ...byText].forEach((u) => merged.set(u._id.toHexString(), u as UserSummaryDoc));
    const ids = [...merged.values()].map((u) => u._id);
    // People with private profiles are not discoverable through search.
    const privateIds = new Set(
      (await ctx.cols.userSettings.find({ userId: { $in: ids }, profileVisibility: 'private' }, { projection: { userId: 1 } }).toArray()).map((s) => s.userId.toHexString()),
    );
    result.users = [...merged.values()].filter((u) => !privateIds.has(u._id.toHexString()) || ctx.actor?.userId.equals(u._id)).slice(0, limit).map(toUserSummary);
  }

  if (type === 'all' || type === 'crews') {
    const visibility = { $in: ['public', 'application', 'invite_only'] as ('public' | 'application' | 'invite_only')[] };
    const bySlug = await ctx.cols.crews.find({ slug: prefix, deletedAt: null, visibility }, { projection: CREW_SUMMARY_PROJECTION }).limit(limit).toArray();
    const byText =
      q.length >= 2
        ? await ctx.cols.crews
            .find({ $text: { $search: q }, deletedAt: null, visibility }, { projection: { ...CREW_SUMMARY_PROJECTION, score: { $meta: 'textScore' } } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .toArray()
        : [];
    const merged = new Map<string, (typeof bySlug)[number]>();
    [...bySlug, ...byText].forEach((c) => merged.set(c._id.toHexString(), c));
    result.crews = [...merged.values()].slice(0, limit).map(toCrewSummary);
  }

  if ((type === 'all' || type === 'vehicles') && q.length >= 2) {
    const docs = await ctx.cols.vehicles
      .find({ $text: { $search: q }, visibility: 'public', deletedAt: null, ownerId: { $nin: blocked } }, { projection: { score: { $meta: 'textScore' } } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .toArray();
    const owners = await loadUserSummaries(ctx.cols.users, docs.map((d) => d.ownerId));
    result.vehicles = (docs as VehicleDoc[])
      .filter((d) => owners.has(d.ownerId.toHexString()))
      .map((d) => ({ ...toVehicleSummary(d), owner: owners.get(d.ownerId.toHexString())! }));
  }
  return result;
}
