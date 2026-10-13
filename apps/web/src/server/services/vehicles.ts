import 'server-only';
import { decodeCursor, encodeCursor, isDateIdCursor, isDuplicateKeyError, type VehicleDoc } from '@vogn/database';
import {
  BUILT_IN_MOD_CATEGORIES,
  type BuildUpdate,
  type ModificationCategory,
  type VehicleComment,
  type VehicleDetail,
  type VehicleSummary,
} from '@vogn/types';
import type {
  BuildUpdateCreateInput,
  ModificationsInput,
  VehicleCreateInput,
  VehicleUpdateInput,
} from '@vogn/validation';
import { buildUpdateCreateSchema, modificationsSchema, vehicleCreateSchema, vehicleUpdateSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import type { AuthedContext, ServiceContext } from '../context';
import { encryptField, lookupHash } from '../crypto';
import { AppError, forbidden, notFound } from '../errors';
import { loadUserSummaries, toMediaRef, toVehicleSummary } from '../mappers';
import { runAfterResponse } from '../after';
import { audit } from './audit';
import { deleteMedia, resolveOwnedMedia, resolveOwnedMediaEmbed, toEmbed } from './media';
import { notify } from './notifications';
import { getSettings, isBlockedEitherWay, viewerMatchesAudience } from './users';

const MAX_VEHICLES = 50;

export const DEFAULT_CATEGORIES: ModificationCategory[] = BUILT_IN_MOD_CATEGORIES.map((key) => ({
  id: key,
  name: key === 'ecu' ? 'ECU & tuning' : key.charAt(0).toUpperCase() + key.slice(1),
  builtIn: key,
}));

export async function canViewVehicle(ctx: ServiceContext, vehicle: VehicleDoc): Promise<boolean> {
  if (vehicle.deletedAt) return false;
  const viewerId = ctx.actor?.userId ?? null;
  if (viewerId && viewerId.equals(vehicle.ownerId)) return true;
  if (viewerId && (await isBlockedEitherWay(ctx, viewerId, vehicle.ownerId))) return false;
  const owner = await ctx.cols.users.findOne({ _id: vehicle.ownerId }, { projection: { status: 1 } });
  if (!owner || owner.status !== 'active') return false;
  return viewerMatchesAudience(ctx, vehicle.visibility, vehicle.ownerId, viewerId, vehicle.visibleCrewIds);
}

async function loadOwnedVehicle(ctx: AuthedContext, id: ObjectId): Promise<VehicleDoc> {
  const vehicle = await ctx.cols.vehicles.findOne({ _id: id, deletedAt: null });
  if (!vehicle) throw notFound('Vehicle');
  if (!vehicle.ownerId.equals(ctx.actor.userId)) {
    // Do not reveal existence of vehicles the actor cannot see.
    if (await canViewVehicle(ctx, vehicle)) throw forbidden();
    throw notFound('Vehicle');
  }
  return vehicle;
}

async function validateCrewIds(ctx: AuthedContext, ids: string[] | undefined): Promise<ObjectId[] | undefined> {
  if (ids === undefined) return undefined;
  const objectIds = ids.map((id) => ObjectId.createFromHexString(id));
  if (!objectIds.length) return [];
  const memberships = await ctx.cols.crewMembers
    .find({ userId: ctx.actor.userId, status: 'active', crewId: { $in: objectIds } }, { projection: { crewId: 1 } })
    .toArray();
  if (memberships.length !== objectIds.length) throw forbidden('You can only share vehicles with crews you belong to.');
  return objectIds;
}

async function writeIdentifiers(ctx: AuthedContext, vehicleId: ObjectId, identifiers: VehicleCreateInput['identifiers']) {
  if (identifiers === undefined) return;
  if (identifiers === null || (!identifiers.registrationNumber && !identifiers.vin)) {
    await ctx.cols.vehiclePrivate.deleteOne({ vehicleId });
    return;
  }
  const reg = identifiers.registrationNumber ?? null;
  const vin = identifiers.vin ?? null;
  await ctx.cols.vehiclePrivate.updateOne(
    { vehicleId },
    {
      $set: {
        ownerId: ctx.actor.userId,
        countryCode: identifiers.countryCode,
        registrationEnc: reg ? encryptField(reg) : null,
        vinEnc: vin ? encryptField(vin) : null,
        registrationHash: reg ? lookupHash(`${identifiers.countryCode}:${reg}`, 'registration') : null,
        vinHash: vin ? lookupHash(vin, 'vin') : null,
        updatedAt: ctx.now,
      },
      $setOnInsert: { _id: new ObjectId(), vehicleId, createdAt: ctx.now },
    },
    { upsert: true },
  );
}

function specsFrom(input: VehicleCreateInput['specs'], base?: VehicleDoc['specs']): VehicleDoc['specs'] {
  const b = base ?? {
    engine: null,
    displacementCc: null,
    aspiration: null,
    fuel: null,
    originalHp: null,
    currentHp: null,
    torqueNm: null,
    weightKg: null,
  };
  if (!input) return b;
  return {
    engine: input.engine !== undefined ? (input.engine ?? null) : b.engine,
    displacementCc: input.displacementCc !== undefined ? (input.displacementCc ?? null) : b.displacementCc,
    aspiration: input.aspiration !== undefined ? (input.aspiration ?? null) : b.aspiration,
    fuel: input.fuel !== undefined ? (input.fuel ?? null) : b.fuel,
    originalHp: input.originalHp !== undefined ? (input.originalHp ?? null) : b.originalHp,
    currentHp: input.currentHp !== undefined ? (input.currentHp ?? null) : b.currentHp,
    torqueNm: input.torqueNm !== undefined ? (input.torqueNm ?? null) : b.torqueNm,
    weightKg: input.weightKg !== undefined ? (input.weightKg ?? null) : b.weightKg,
  };
}

export async function createVehicle(ctx: AuthedContext, raw: VehicleCreateInput): Promise<VehicleDetail> {
  const input = vehicleCreateSchema.parse(raw);
  const count = await ctx.cols.vehicles.countDocuments({ ownerId: ctx.actor.userId, deletedAt: null });
  if (count >= MAX_VEHICLES) throw new AppError('CONFLICT', `A garage can hold up to ${MAX_VEHICLES} vehicles.`);
  const settings = await getSettings(ctx, ctx.actor.userId);
  const cover = await resolveOwnedMediaEmbed(ctx, input.coverMediaId, ['vehicle']);
  const owner = await ctx.cols.users.findOne({ _id: ctx.actor.userId }, { projection: { country: 1, featuredVehicleId: 1 } });

  const doc: VehicleDoc = {
    _id: new ObjectId(),
    ownerId: ctx.actor.userId,
    make: input.make,
    makeLower: input.make.toLowerCase(),
    model: input.model,
    modelLower: input.model.toLowerCase(),
    generation: input.generation ?? null,
    year: input.year ?? null,
    trim: input.trim ?? null,
    nickname: input.nickname ?? null,
    description: input.description ?? null,
    color: input.color ?? null,
    drivetrain: input.drivetrain ?? null,
    transmission: input.transmission ?? null,
    specs: specsFrom(input.specs),
    wheels: { front: input.wheels?.front ?? null, rear: input.wheels?.rear ?? null, tires: input.wheels?.tires ?? null },
    suspension: input.suspension ?? null,
    exhaust: input.exhaust ?? null,
    ecuTuning: input.ecuTuning ?? null,
    turbo: input.turbo ?? null,
    interior: input.interior ?? null,
    audio: input.audio ?? null,
    categories: DEFAULT_CATEGORIES,
    modifications: [],
    modCategoryKeys: [],
    coverImage: cover ?? null,
    gallery: cover ? [cover] : [],
    officialData: null,
    visibility: input.visibility ?? settings.garageVisibility,
    visibleCrewIds: (await validateCrewIds(ctx, input.visibleCrewIds)) ?? [],
    likesEnabled: input.likesEnabled ?? true,
    commentsEnabled: input.commentsEnabled ?? true,
    showExpenses: input.showExpenses ?? false,
    likeCount: 0,
    commentCount: 0,
    verification: { specsConfirmed: false, accessReviewed: false, ownershipEvidenceReviewed: false },
    ownerCountry: owner?.country ?? null,
    lastBuildUpdateAt: null,
    deletedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.cols.vehicles.insertOne(doc);
  await writeIdentifiers(ctx, doc._id, input.identifiers);
  if (owner && !owner.featuredVehicleId) {
    await ctx.cols.users.updateOne({ _id: ctx.actor.userId }, { $set: { featuredVehicleId: doc._id } });
  }
  return getVehicleDetail(ctx, doc._id);
}

export async function updateVehicle(ctx: AuthedContext, id: ObjectId, raw: VehicleUpdateInput): Promise<VehicleDetail> {
  const input = vehicleUpdateSchema.parse(raw);
  const vehicle = await loadOwnedVehicle(ctx, id);
  const set: Partial<VehicleDoc> = { updatedAt: ctx.now };
  const assign = <K extends keyof VehicleDoc>(key: K, value: VehicleDoc[K] | undefined) => {
    if (value !== undefined) set[key] = value;
  };
  if (input.make !== undefined) {
    set.make = input.make;
    set.makeLower = input.make.toLowerCase();
  }
  if (input.model !== undefined) {
    set.model = input.model;
    set.modelLower = input.model.toLowerCase();
  }
  assign('generation', input.generation === undefined ? undefined : (input.generation ?? null));
  assign('year', input.year === undefined ? undefined : (input.year ?? null));
  assign('trim', input.trim === undefined ? undefined : (input.trim ?? null));
  assign('nickname', input.nickname === undefined ? undefined : (input.nickname ?? null));
  assign('description', input.description === undefined ? undefined : (input.description ?? null));
  assign('color', input.color === undefined ? undefined : (input.color ?? null));
  assign('drivetrain', input.drivetrain === undefined ? undefined : (input.drivetrain ?? null));
  assign('transmission', input.transmission === undefined ? undefined : (input.transmission ?? null));
  for (const key of ['suspension', 'exhaust', 'ecuTuning', 'turbo', 'interior', 'audio'] as const) {
    if (input[key] !== undefined) set[key] = input[key] ?? null;
  }
  if (input.specs) set.specs = specsFrom(input.specs, vehicle.specs);
  if (input.wheels) {
    set.wheels = {
      front: input.wheels.front !== undefined ? (input.wheels.front ?? null) : vehicle.wheels.front,
      rear: input.wheels.rear !== undefined ? (input.wheels.rear ?? null) : vehicle.wheels.rear,
      tires: input.wheels.tires !== undefined ? (input.wheels.tires ?? null) : vehicle.wheels.tires,
    };
  }
  assign('visibility', input.visibility);
  assign('visibleCrewIds', await validateCrewIds(ctx, input.visibleCrewIds));
  assign('likesEnabled', input.likesEnabled);
  assign('commentsEnabled', input.commentsEnabled);
  assign('showExpenses', input.showExpenses);
  if (input.coverMediaId !== undefined) {
    if (input.coverMediaId === null) set.coverImage = null;
    else {
      const inGallery = vehicle.gallery.find((g) => g.mediaId.toHexString() === input.coverMediaId);
      set.coverImage = inGallery ?? (await resolveOwnedMediaEmbed(ctx, input.coverMediaId, ['vehicle'])) ?? null;
      if (!inGallery && set.coverImage) set.gallery = [set.coverImage, ...vehicle.gallery].slice(0, 60);
    }
  }
  // Specs changed after official confirmation → confirmation no longer applies to the edited make/model.
  if ((input.make && input.make !== vehicle.make) || (input.model && input.model !== vehicle.model)) {
    set.verification = { ...vehicle.verification, specsConfirmed: false };
  }
  await ctx.cols.vehicles.updateOne({ _id: id }, { $set: set });
  await writeIdentifiers(ctx, id, input.identifiers);
  if (input.identifiers !== undefined) await audit(ctx, { action: 'vehicle.identifiers_updated', targetType: 'vehicle', targetId: id });
  return getVehicleDetail(ctx, id);
}

export async function deleteVehicle(ctx: AuthedContext, id: ObjectId): Promise<void> {
  const vehicle = await loadOwnedVehicle(ctx, id);
  await ctx.cols.vehicles.updateOne({ _id: id }, { $set: { deletedAt: ctx.now, updatedAt: ctx.now, gallery: [], coverImage: null } });
  await Promise.all([
    ctx.cols.vehiclePrivate.deleteOne({ vehicleId: id }),
    ctx.cols.vehicleLikes.deleteMany({ vehicleId: id }),
    ctx.cols.vehicleComments.deleteMany({ vehicleId: id }),
    ctx.cols.users.updateOne({ _id: ctx.actor.userId, featuredVehicleId: id }, { $set: { featuredVehicleId: null } }),
  ]);
  const updates = await ctx.cols.vehicleBuildUpdates.find({ vehicleId: id }).toArray();
  await ctx.cols.vehicleBuildUpdates.deleteMany({ vehicleId: id });
  const mediaIds = [
    ...vehicle.gallery.map((g) => g.mediaId),
    ...updates.flatMap((u) => [...u.media.map((m) => m.mediaId), u.before?.mediaId, u.after?.mediaId]),
  ].filter((m): m is ObjectId => Boolean(m));
  runAfterResponse(async () => {
    for (const mediaId of mediaIds) await deleteMedia(ctx, mediaId).catch(() => undefined);
  });
  await audit(ctx, { action: 'vehicle.deleted', targetType: 'vehicle', targetId: id });
}

export async function getVehicleDetail(ctx: ServiceContext, id: ObjectId): Promise<VehicleDetail> {
  const vehicle = await ctx.cols.vehicles.findOne({ _id: id, deletedAt: null });
  if (!vehicle || !(await canViewVehicle(ctx, vehicle))) throw notFound('Vehicle');
  const viewerId = ctx.actor?.userId ?? null;
  const isOwner = Boolean(viewerId?.equals(vehicle.ownerId));
  const [owners, liked, privateDoc, expenses] = await Promise.all([
    loadUserSummaries(ctx.cols.users, [vehicle.ownerId]),
    viewerId ? ctx.cols.vehicleLikes.findOne({ vehicleId: id, userId: viewerId }, { projection: { _id: 1 } }) : null,
    isOwner ? ctx.cols.vehiclePrivate.findOne({ vehicleId: id }, { projection: { countryCode: 1 } }) : null,
    isOwner || vehicle.showExpenses
      ? ctx.cols.vehicleBuildUpdates
          .aggregate<{ _id: string; total: number }>([
            { $match: { vehicleId: id, cost: { $ne: null } } },
            { $group: { _id: '$cost.currency', total: { $sum: '$cost.amount' } } },
            { $sort: { total: -1 } },
            { $limit: 1 },
          ])
          .toArray()
      : Promise.resolve([]),
  ]);
  const owner = owners.get(vehicle.ownerId.toHexString());
  if (!owner) throw notFound('Vehicle');
  const topExpense = expenses[0];
  return {
    ...toVehicleSummary(vehicle),
    owner,
    description: vehicle.description,
    color: vehicle.color,
    drivetrain: vehicle.drivetrain,
    transmission: vehicle.transmission,
    specs: vehicle.specs,
    wheels: vehicle.wheels,
    suspension: vehicle.suspension,
    exhaust: vehicle.exhaust,
    ecuTuning: vehicle.ecuTuning,
    turbo: vehicle.turbo,
    interior: vehicle.interior,
    audio: vehicle.audio,
    categories: vehicle.categories,
    modifications: vehicle.modifications,
    officialData: vehicle.officialData,
    gallery: vehicle.gallery.map((g) => toMediaRef(g)!).filter(Boolean),
    visibleCrewIds: isOwner ? vehicle.visibleCrewIds.map((c) => c.toHexString()) : [],
    likesEnabled: vehicle.likesEnabled,
    commentsEnabled: vehicle.commentsEnabled,
    showExpenses: vehicle.showExpenses,
    totalExpenses: topExpense ? { amount: topExpense.total, currency: topExpense._id } : null,
    commentCount: vehicle.commentCount,
    createdAt: vehicle.createdAt.toISOString(),
    viewer: {
      isOwner,
      liked: Boolean(liked),
      canComment: Boolean(viewerId) && vehicle.commentsEnabled && !ctx.actor?.suspended,
      ...(isOwner ? { hasPrivateIdentifiers: Boolean(privateDoc), registrationCountry: privateDoc?.countryCode ?? null } : {}),
    },
  };
}

export async function listGarage(ctx: ServiceContext, ownerId: ObjectId): Promise<VehicleSummary[]> {
  const viewerId = ctx.actor?.userId ?? null;
  const vehicles = await ctx.cols.vehicles.find({ ownerId, deletedAt: null }).sort({ createdAt: -1 }).limit(MAX_VEHICLES).toArray();
  if (viewerId?.equals(ownerId)) return vehicles.map(toVehicleSummary);
  if (viewerId && (await isBlockedEitherWay(ctx, viewerId, ownerId))) return [];
  const visible: VehicleSummary[] = [];
  for (const v of vehicles) {
    if (await viewerMatchesAudience(ctx, v.visibility, ownerId, viewerId, v.visibleCrewIds)) visible.push(toVehicleSummary(v));
  }
  return visible;
}

export async function setModifications(ctx: AuthedContext, id: ObjectId, raw: ModificationsInput): Promise<VehicleDetail> {
  const input = modificationsSchema.parse(raw);
  await loadOwnedVehicle(ctx, id);
  const categories: ModificationCategory[] = input.categories.map((c) => ({ id: c.id, name: c.name, builtIn: c.builtIn }));
  const modifications = input.modifications.map((m) => ({
    id: m.id,
    categoryId: m.categoryId,
    name: m.name,
    brand: m.brand,
    notes: m.notes,
    installedAt: m.installedAt,
    fields: m.fields,
  }));
  const usedCategoryIds = new Set(modifications.map((m) => m.categoryId));
  const modCategoryKeys = categories.filter((c) => usedCategoryIds.has(c.id)).map((c) => (c.builtIn ?? c.name).toLowerCase());
  await ctx.cols.vehicles.updateOne({ _id: id }, { $set: { categories, modifications, modCategoryKeys, updatedAt: ctx.now } });
  return getVehicleDetail(ctx, id);
}

export async function setGallery(ctx: AuthedContext, id: ObjectId, mediaIds: string[]): Promise<VehicleDetail> {
  const vehicle = await loadOwnedVehicle(ctx, id);
  const existing = new Map(vehicle.gallery.map((g) => [g.mediaId.toHexString(), g]));
  const newIds = mediaIds.filter((m) => !existing.has(m));
  const resolved = await resolveOwnedMedia(ctx, newIds, ['vehicle']);
  const fresh = new Map(resolved.map((d) => [d._id.toHexString(), toEmbed(d)]));
  const gallery = mediaIds.map((m) => existing.get(m) ?? fresh.get(m)!).filter(Boolean);
  const removed = vehicle.gallery.filter((g) => !mediaIds.includes(g.mediaId.toHexString()));
  const coverStillPresent = vehicle.coverImage && gallery.some((g) => g.mediaId.equals(vehicle.coverImage!.mediaId));
  await ctx.cols.vehicles.updateOne(
    { _id: id },
    { $set: { gallery, coverImage: coverStillPresent ? vehicle.coverImage : (gallery[0] ?? null), updatedAt: ctx.now } },
  );
  runAfterResponse(async () => {
    for (const r of removed) await deleteMedia(ctx, r.mediaId).catch(() => undefined);
  });
  return getVehicleDetail(ctx, id);
}

/* ------------------------------- build updates ------------------------------- */

function toBuildUpdate(u: import('@vogn/database').BuildUpdateDoc, showCost: boolean): BuildUpdate {
  return {
    id: u._id.toHexString(),
    vehicleId: u.vehicleId.toHexString(),
    kind: u.kind,
    title: u.title,
    body: u.body,
    occurredAt: u.occurredAt.toISOString(),
    media: u.media.map((m) => toMediaRef(m)!),
    before: toMediaRef(u.before),
    after: toMediaRef(u.after),
    cost: showCost ? u.cost : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listBuildUpdates(ctx: ServiceContext, vehicleId: ObjectId, cursor: string | undefined, limit = 20) {
  const vehicle = await ctx.cols.vehicles.findOne({ _id: vehicleId, deletedAt: null });
  if (!vehicle || !(await canViewVehicle(ctx, vehicle))) throw notFound('Vehicle');
  const showCost = vehicle.showExpenses || Boolean(ctx.actor?.userId.equals(vehicle.ownerId));
  const c = decodeCursor(cursor, isDateIdCursor);
  const filter: Record<string, unknown> = { vehicleId };
  if (c) {
    const at = new Date(c.t);
    filter.$or = [{ occurredAt: { $lt: at } }, { occurredAt: at, _id: { $lt: ObjectId.createFromHexString(c.id) } }];
  }
  const docs = await ctx.cols.vehicleBuildUpdates.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(limit).toArray();
  const last = docs[docs.length - 1];
  return {
    items: docs.map((d) => toBuildUpdate(d, showCost)),
    nextCursor: docs.length === limit && last ? encodeCursor({ t: last.occurredAt.getTime(), id: last._id.toHexString() }) : null,
  };
}

export async function createBuildUpdate(ctx: AuthedContext, vehicleId: ObjectId, raw: BuildUpdateCreateInput): Promise<BuildUpdate> {
  const input = buildUpdateCreateSchema.parse(raw);
  await loadOwnedVehicle(ctx, vehicleId);
  const media = await resolveOwnedMedia(ctx, input.mediaIds, ['build_update', 'vehicle']);
  const before = await resolveOwnedMediaEmbed(ctx, input.beforeMediaId, ['build_update', 'vehicle']);
  const after = await resolveOwnedMediaEmbed(ctx, input.afterMediaId, ['build_update', 'vehicle']);
  const doc = {
    _id: new ObjectId(),
    vehicleId,
    authorId: ctx.actor.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    occurredAt: new Date(input.occurredAt),
    media: media.map((m) => toEmbed(m)),
    before: before ?? null,
    after: after ?? null,
    cost: input.cost ?? null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.cols.vehicleBuildUpdates.insertOne(doc);
  await ctx.cols.vehicles.updateOne({ _id: vehicleId }, { $set: { lastBuildUpdateAt: ctx.now, updatedAt: ctx.now } });
  return toBuildUpdate(doc, true);
}

export async function updateBuildUpdate(
  ctx: AuthedContext,
  vehicleId: ObjectId,
  updateId: ObjectId,
  raw: Partial<BuildUpdateCreateInput>,
): Promise<BuildUpdate> {
  const input = buildUpdateCreateSchema.partial().parse(raw);
  await loadOwnedVehicle(ctx, vehicleId);
  const existing = await ctx.cols.vehicleBuildUpdates.findOne({ _id: updateId, vehicleId });
  if (!existing) throw notFound('Build update');
  const set: Record<string, unknown> = { updatedAt: ctx.now };
  if (input.kind) set.kind = input.kind;
  if (input.title) set.title = input.title;
  if (input.body !== undefined) set.body = input.body ?? null;
  if (input.occurredAt) set.occurredAt = new Date(input.occurredAt);
  if (input.cost !== undefined) set.cost = input.cost ?? null;
  if (input.mediaIds) set.media = (await resolveOwnedMedia(ctx, input.mediaIds, ['build_update', 'vehicle'])).map((m) => toEmbed(m));
  const before = await resolveOwnedMediaEmbed(ctx, input.beforeMediaId, ['build_update', 'vehicle']);
  if (before !== undefined) set.before = before;
  const after = await resolveOwnedMediaEmbed(ctx, input.afterMediaId, ['build_update', 'vehicle']);
  if (after !== undefined) set.after = after;
  await ctx.cols.vehicleBuildUpdates.updateOne({ _id: updateId }, { $set: set });
  const updated = await ctx.cols.vehicleBuildUpdates.findOne({ _id: updateId });
  return toBuildUpdate(updated!, true);
}

export async function deleteBuildUpdate(ctx: AuthedContext, vehicleId: ObjectId, updateId: ObjectId): Promise<void> {
  await loadOwnedVehicle(ctx, vehicleId);
  const res = await ctx.cols.vehicleBuildUpdates.findOneAndDelete({ _id: updateId, vehicleId });
  if (!res) throw notFound('Build update');
  const mediaIds = [...res.media.map((m) => m.mediaId), res.before?.mediaId, res.after?.mediaId].filter((m): m is ObjectId => Boolean(m));
  runAfterResponse(async () => {
    for (const m of mediaIds) await deleteMedia(ctx, m).catch(() => undefined);
  });
}

/* ------------------------------ likes & comments ------------------------------ */

async function loadViewableVehicle(ctx: AuthedContext, id: ObjectId): Promise<VehicleDoc> {
  const vehicle = await ctx.cols.vehicles.findOne({ _id: id, deletedAt: null });
  if (!vehicle || !(await canViewVehicle(ctx, vehicle))) throw notFound('Vehicle');
  return vehicle;
}

export async function setLike(ctx: AuthedContext, id: ObjectId, like: boolean): Promise<{ liked: boolean; likeCount: number }> {
  const vehicle = await loadViewableVehicle(ctx, id);
  if (!vehicle.likesEnabled) throw forbidden('Likes are disabled for this vehicle.');
  if (like) {
    try {
      await ctx.cols.vehicleLikes.insertOne({ _id: new ObjectId(), vehicleId: id, userId: ctx.actor.userId, createdAt: ctx.now });
      await ctx.cols.vehicles.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
      await notify(ctx, {
        userId: vehicle.ownerId,
        type: 'reaction',
        actorId: ctx.actor.userId,
        title: `${ctx.actor.displayName} liked your ${vehicle.make} ${vehicle.model}`,
        link: `/v/${id.toHexString()}`,
        groupKey: `vehicle_like:${id.toHexString()}`,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  } else {
    const res = await ctx.cols.vehicleLikes.deleteOne({ vehicleId: id, userId: ctx.actor.userId });
    if (res.deletedCount) await ctx.cols.vehicles.updateOne({ _id: id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
  }
  const updated = await ctx.cols.vehicles.findOne({ _id: id }, { projection: { likeCount: 1 } });
  return { liked: like, likeCount: updated?.likeCount ?? 0 };
}

export async function listComments(ctx: ServiceContext, id: ObjectId, cursor: string | undefined, limit = 30) {
  const vehicle = await ctx.cols.vehicles.findOne({ _id: id, deletedAt: null });
  if (!vehicle || !(await canViewVehicle(ctx, vehicle))) throw notFound('Vehicle');
  const c = decodeCursor(cursor, isDateIdCursor);
  const filter: Record<string, unknown> = { vehicleId: id, deletedAt: null };
  if (c) {
    const at = new Date(c.t);
    filter.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: ObjectId.createFromHexString(c.id) } }];
  }
  const docs = await ctx.cols.vehicleComments.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
  // Hide comments from users the viewer blocked.
  const blocked = ctx.actor
    ? new Set((await ctx.cols.userBlocks.find({ blockerId: ctx.actor.userId }, { projection: { blockedId: 1 } }).toArray()).map((b) => b.blockedId.toHexString()))
    : new Set<string>();
  const authors = await loadUserSummaries(ctx.cols.users, docs.map((d) => d.authorId));
  const isOwner = Boolean(ctx.actor?.userId.equals(vehicle.ownerId));
  const items: VehicleComment[] = docs
    .filter((d) => !blocked.has(d.authorId.toHexString()))
    .map((d) => ({
      id: d._id.toHexString(),
      vehicleId: id.toHexString(),
      author: authors.get(d.authorId.toHexString())!,
      body: d.body,
      createdAt: d.createdAt.toISOString(),
      canDelete: isOwner || Boolean(ctx.actor?.userId.equals(d.authorId)),
    }))
    .filter((c2) => Boolean(c2.author));
  const last = docs[docs.length - 1];
  return { items, nextCursor: docs.length === limit && last ? encodeCursor({ t: last.createdAt.getTime(), id: last._id.toHexString() }) : null };
}

export async function addComment(ctx: AuthedContext, id: ObjectId, body: string): Promise<VehicleComment> {
  const vehicle = await loadViewableVehicle(ctx, id);
  if (!vehicle.commentsEnabled) throw forbidden('Comments are disabled for this vehicle.');
  if (ctx.actor.suspended) throw forbidden('Your account is suspended.');
  const doc = { _id: new ObjectId(), vehicleId: id, authorId: ctx.actor.userId, body, deletedAt: null, createdAt: ctx.now, updatedAt: ctx.now };
  await ctx.cols.vehicleComments.insertOne(doc);
  await ctx.cols.vehicles.updateOne({ _id: id }, { $inc: { commentCount: 1 } });
  await notify(ctx, {
    userId: vehicle.ownerId,
    type: 'reply',
    actorId: ctx.actor.userId,
    title: `${ctx.actor.displayName} commented on your ${vehicle.make} ${vehicle.model}`,
    body: body.slice(0, 140),
    link: `/v/${id.toHexString()}#comments`,
  });
  const authors = await loadUserSummaries(ctx.cols.users, [ctx.actor.userId]);
  return {
    id: doc._id.toHexString(),
    vehicleId: id.toHexString(),
    author: authors.get(ctx.actor.userId.toHexString())!,
    body,
    createdAt: ctx.now.toISOString(),
    canDelete: true,
  };
}

export async function deleteComment(ctx: AuthedContext, vehicleId: ObjectId, commentId: ObjectId): Promise<void> {
  const [vehicle, comment] = await Promise.all([
    ctx.cols.vehicles.findOne({ _id: vehicleId, deletedAt: null }, { projection: { ownerId: 1 } }),
    ctx.cols.vehicleComments.findOne({ _id: commentId, vehicleId, deletedAt: null }),
  ]);
  if (!vehicle || !comment) throw notFound('Comment');
  if (!comment.authorId.equals(ctx.actor.userId) && !vehicle.ownerId.equals(ctx.actor.userId)) throw forbidden();
  await ctx.cols.vehicleComments.updateOne({ _id: commentId }, { $set: { deletedAt: ctx.now, body: '' } });
  await ctx.cols.vehicles.updateOne({ _id: vehicleId, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
}
