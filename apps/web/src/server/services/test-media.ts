import 'server-only';
import type { MediaAssetDoc } from '@vogn/database';
import { Binary, ObjectId } from 'mongodb';
import sharp from 'sharp';
import type { z } from 'zod';
import { IMAGE_MIME_TYPES, MEDIA_LIMITS, mediaSignSchema } from '@vogn/validation';
import { z as schema } from 'zod';
import type { AuthedContext } from '../context';
import { requireActive } from '../context';
import { getEnv } from '../env';
import { AppError, configMissing, notFound } from '../errors';
import { assertConversationAccess } from './conversation-access';
import { getVisibleCrewAccess } from './crew-access';
import { getEvent } from './events';
import { authorizeContext, toEmbed } from './media';
import { getPublicProfile } from './users';
import { canViewVehicle } from './vehicles';

// Small sanitized images only: comfortably below Vercel's request/response body limits.
export const TEST_IMAGE_BYTES = MEDIA_LIMITS.testImageBytes;
export const testImageSchema = mediaSignSchema.extend({ base64: schema.string().max(Math.ceil(TEST_IMAGE_BYTES / 3) * 4) });

function requireTestStorage() {
  const env = getEnv();
  if (!env.TEST_AUTH_ENABLED || !env.TEST_MEDIA_ENABLED) throw configMissing('Private test image storage', ['TEST_MEDIA_ENABLED']);
}

export async function uploadTestImage(ctx: AuthedContext, input: z.output<typeof testImageSchema>) {
  requireTestStorage();
  requireActive(ctx);
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(input.mime)) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Private test storage supports images. Video uploads require Cloudinary.');
  }
  const contextId = await authorizeContext(ctx, input.purpose, input.contextId);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) throw new AppError('VALIDATION_FAILED', 'Invalid image encoding.');
  const original = Buffer.from(input.base64, 'base64');
  if (original.length > TEST_IMAGE_BYTES) throw new AppError('PAYLOAD_TOO_LARGE', 'Test images must be smaller than 2 MB.');
  if (original.length !== input.size) throw new AppError('VALIDATION_FAILED', 'Image size does not match.');
  let sanitized: { data: Buffer; info: { width: number; height: number } };
  try {
    sanitized = await sharp(original, { limitInputPixels: 25_000_000 }).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The file could not be decoded as an image.');
  }
  if (sanitized.data.length > TEST_IMAGE_BYTES) throw new AppError('PAYLOAD_TOO_LARGE', 'Image is too large after processing.');
  const id = new ObjectId();
  const doc: MediaAssetDoc = {
    _id: id, ownerId: ctx.actor.userId, provider: 'mongo-test', publicId: `test/${id.toHexString()}`,
    resourceType: 'image', kind: 'image', url: `/api/v1/media/test-image/${id.toHexString()}`,
    mime: 'image/webp', bytes: sanitized.data.length, width: sanitized.info.width, height: sanitized.info.height,
    purpose: input.purpose, contextId, originalFilename: input.filename ?? null, status: 'ready', attachedTo: null,
    createdAt: ctx.now, updatedAt: ctx.now,
  };
  // Keep binary data separate from ordinary metadata queries and never write to ephemeral local disk.
  await ctx.db.collection('privateTestMedia').insertOne({ _id: id, bytes: new Binary(sanitized.data), createdAt: ctx.now });
  try { await ctx.cols.mediaAssets.insertOne(doc); }
  catch (error) { await ctx.db.collection('privateTestMedia').deleteOne({ _id: id }); throw error; }
  const embed = toEmbed(doc);
  return { ...embed, id: id.toHexString(), mediaId: undefined, purpose: doc.purpose };
}

export async function readTestImage(ctx: AuthedContext, id: ObjectId) {
  requireTestStorage();
  const doc = await ctx.cols.mediaAssets.findOne({ _id: id, provider: 'mongo-test', status: 'ready' });
  if (!doc) throw notFound('Image');
  if (!doc.ownerId.equals(ctx.actor.userId)) {
    if (doc.contextId) {
      if (doc.purpose === 'message') {
        await assertConversationAccess(ctx, doc.contextId);
        if (!await ctx.cols.messages.findOne({ conversationId: doc.contextId, 'attachments.mediaId': id, deletedAt: null }, { projection: { _id: 1 } })) throw notFound('Image');
      }
      else {
        const access = await getVisibleCrewAccess(ctx, doc.contextId);
        let attached = Boolean((doc.purpose === 'crew_icon' && access.crew.icon?.mediaId.equals(id)) || (doc.purpose === 'crew_banner' && access.crew.banner?.mediaId.equals(id)));
        if (doc.purpose === 'event_cover') {
          const event = await ctx.cols.events.findOne({ crewId: doc.contextId, 'coverImage.mediaId': id, deletedAt: null });
          if (event) { await getEvent(ctx, event._id); attached = true; }
        }
        if (!attached) throw notFound('Image');
      }
    } else if (['avatar', 'banner'].includes(doc.purpose)) {
      const user = await ctx.cols.users.findOne({ _id: doc.ownerId, status: { $ne: 'deleted' }, $or: [{ 'avatar.mediaId': id }, { 'banner.mediaId': id }] });
      if (!user) throw notFound('Image');
      const profile = await getPublicProfile(ctx, user.username);
      const visible = doc.purpose === 'avatar' ? profile.avatar : profile.banner;
      if (visible?.id !== id.toHexString()) throw notFound('Image');
    } else if (['vehicle', 'build_update'].includes(doc.purpose)) {
      let vehicle = await ctx.cols.vehicles.findOne({ deletedAt: null, $or: [{ 'coverImage.mediaId': id }, { 'gallery.mediaId': id }] });
      if (!vehicle && doc.purpose === 'build_update') {
        const update = await ctx.cols.vehicleBuildUpdates.findOne({ 'media.mediaId': id, deletedAt: null });
        if (update) vehicle = await ctx.cols.vehicles.findOne({ _id: update.vehicleId, deletedAt: null });
      }
      if (!vehicle || !await canViewVehicle(ctx, vehicle)) throw notFound('Image');
    } else {
      const crew = await ctx.cols.crews.findOne({ deletedAt: null, $or: [{ 'icon.mediaId': id }, { 'banner.mediaId': id }] });
      if (!crew) throw notFound('Image');
      await getVisibleCrewAccess(ctx, crew);
    }
  }
  const binary = await ctx.db.collection<{ _id: ObjectId; bytes: Binary }>('privateTestMedia').findOne({ _id: id });
  if (!binary) throw notFound('Image');
  return new Response(new Uint8Array(binary.bytes.buffer), { headers: { 'Content-Type': doc.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
