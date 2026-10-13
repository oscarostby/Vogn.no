import 'server-only';
import type { MediaAssetDoc, MediaEmbed } from '@vogn/database';
import type { MediaPurpose } from '@vogn/types';
import {
  FILE_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MEDIA_LIMITS,
  mediaCompleteSchema,
  type MediaSignInput,
  VIDEO_MIME_TYPES,
} from '@vogn/validation';
import { ObjectId } from 'mongodb';
import type { z } from 'zod';
import type { AuthedContext } from '../context';
import { randomCode, signToken, verifyToken } from '../crypto';
import { getEnv } from '../env';
import { AppError, badRequest, forbidden, notFound } from '../errors';
import { deliveryUrl, destroyAsset, type ResourceType, signUpload, verifyUploadResponse, videoPosterUrl } from '../integrations/cloudinary';
import { log } from '../log';
import { assertConversationAccess } from './conversation-access';
import { getCrewAccess } from './crew-access';

const PURPOSE_KINDS: Record<string, ('image' | 'video' | 'file')[]> = {
  avatar: ['image'],
  banner: ['image'],
  vehicle: ['image', 'video'],
  build_update: ['image', 'video'],
  crew_icon: ['image'],
  crew_banner: ['image'],
  crew_media: ['image', 'video'],
  message: ['image', 'video', 'file'],
  event_cover: ['image'],
  theme_background: ['image', 'video'],
};

function kindOf(mime: string): 'image' | 'video' | 'file' {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return 'image';
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mime)) return 'video';
  if ((FILE_MIME_TYPES as readonly string[]).includes(mime)) return 'file';
  throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Unsupported file type.');
}

function maxBytesFor(kind: 'image' | 'video' | 'file'): number {
  return kind === 'image' ? MEDIA_LIMITS.imageBytes : kind === 'video' ? MEDIA_LIMITS.videoBytes : MEDIA_LIMITS.fileBytes;
}

const resourceTypeFor = (kind: 'image' | 'video' | 'file'): ResourceType => (kind === 'file' ? 'raw' : kind);

/** Purpose-specific authorization: uploading into a crew or conversation requires access there. */
export async function authorizeContext(ctx: AuthedContext, purpose: string, contextId: string | undefined): Promise<ObjectId | null> {
  if (['crew_icon', 'crew_banner', 'crew_media', 'theme_background', 'event_cover'].includes(purpose)) {
    if (!contextId) {
      // New crews: icon/banner can be uploaded before the crew exists.
      if (purpose === 'crew_icon' || purpose === 'crew_banner') return null;
      throw badRequest('A crew context is required for this upload.');
    }
    const access = await getCrewAccess(ctx, ObjectId.createFromHexString(contextId));
    const needed = purpose === 'theme_background' ? 'MANAGE_THEMES' : purpose === 'event_cover' ? 'MANAGE_EVENTS' : purpose === 'crew_media' ? 'UPLOAD_ATTACHMENTS' : 'MANAGE_CREW';
    if (!access.member || !access.permissions.has(needed)) throw forbidden();
    return access.crew._id;
  }
  if (purpose === 'message') {
    if (!contextId) throw badRequest('A conversation context is required for attachments.');
    const access = await assertConversationAccess(ctx, ObjectId.createFromHexString(contextId));
    if (!access.canUpload) throw forbidden('You cannot upload attachments here.');
    return access.conversation._id;
  }
  return null;
}

export async function createSignedUpload(ctx: AuthedContext, input: MediaSignInput) {
  const kind = kindOf(input.mime);
  if (!PURPOSE_KINDS[input.purpose]?.includes(kind)) throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'File type not allowed here.');
  const maxBytes = maxBytesFor(kind);
  if (input.size > maxBytes) throw new AppError('PAYLOAD_TOO_LARGE', 'File is too large.', { maxBytes });
  const contextId = await authorizeContext(ctx, input.purpose, input.contextId);

  const userHex = ctx.actor.userId.toHexString();
  const publicId = randomCode(12);
  const folder = `${getEnv().CLOUDINARY_UPLOAD_FOLDER}/${input.purpose}/${userHex}`;
  const resourceType = resourceTypeFor(kind);
  const allowedFormats =
    kind === 'image' ? ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic'] : kind === 'video' ? ['mp4', 'mov', 'webm'] : ['pdf', 'txt'];
  const signed = signUpload({ publicId, folder, resourceType, allowedFormats });
  const uploadToken = signToken(
    {
      uid: userHex,
      purpose: input.purpose,
      publicId: `${folder}/${publicId}`,
      rt: resourceType,
      kind,
      mime: input.mime,
      ctx: contextId?.toHexString() ?? null,
      maxBytes,
    },
    15 * 60,
  );
  return { uploadUrl: signed.uploadUrl, fields: signed.fields, uploadToken, maxBytes };
}

interface UploadClaims extends Record<string, unknown> {
  uid: string;
  purpose: MediaPurpose;
  publicId: string;
  rt: ResourceType;
  kind: 'image' | 'video' | 'file';
  mime: string;
  ctx: string | null;
  maxBytes: number;
}

export async function completeUpload(ctx: AuthedContext, input: z.output<typeof mediaCompleteSchema>) {
  const claims = verifyToken<UploadClaims>(input.uploadToken);
  if (!claims || claims.uid !== ctx.actor.userId.toHexString()) throw forbidden('Upload token is invalid or expired.');
  if (claims.publicId !== input.publicId || claims.rt !== input.resourceType) throw forbidden('Upload does not match its token.');
  if (!verifyUploadResponse(input.publicId, input.version, input.signature)) throw forbidden('Upload signature verification failed.');

  if (input.bytes > claims.maxBytes) {
    await destroyAsset(input.publicId, claims.rt).catch(() => undefined);
    throw new AppError('PAYLOAD_TOO_LARGE', 'File is too large.');
  }

  const existing = await ctx.cols.mediaAssets.findOne({ provider: 'cloudinary', publicId: input.publicId });
  if (existing) return toUploadedMedia(existing);

  const doc: MediaAssetDoc = {
    _id: new ObjectId(),
    ownerId: ctx.actor.userId,
    provider: 'cloudinary',
    publicId: input.publicId,
    resourceType: claims.rt,
    kind: claims.kind,
    url: deliveryUrl(input.publicId, claims.rt, input.version, input.format),
    mime: claims.mime,
    bytes: input.bytes,
    width: input.width ?? null,
    height: input.height ?? null,
    purpose: claims.purpose,
    contextId: claims.ctx ? ObjectId.createFromHexString(claims.ctx) : null,
    originalFilename: input.originalFilename ?? null,
    status: 'ready',
    attachedTo: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.cols.mediaAssets.insertOne(doc);
  return toUploadedMedia(doc);
}

function toUploadedMedia(doc: MediaAssetDoc) {
  return {
    id: doc._id.toHexString(),
    kind: doc.kind,
    url: doc.url,
    width: doc.width,
    height: doc.height,
    mime: doc.mime,
    alt: null,
    thumbnailUrl: doc.kind === 'video' ? posterFor(doc) : null,
    purpose: doc.purpose,
  };
}

function posterFor(doc: MediaAssetDoc): string | null {
  const version = /\/v(\d+)\//.exec(doc.url)?.[1];
  try {
    return version ? videoPosterUrl(doc.publicId, Number(version)) : null;
  } catch {
    return null;
  }
}

export function toEmbed(doc: MediaAssetDoc, alt: string | null = null): MediaEmbed {
  return {
    mediaId: doc._id,
    kind: doc.kind,
    url: doc.url,
    width: doc.width,
    height: doc.height,
    mime: doc.mime,
    alt,
    thumbnailUrl: doc.kind === 'video' ? posterFor(doc) : null,
  };
}

/**
 * Resolves media ids the actor uploaded for one of `purposes` (optionally bound to `contextId`).
 * Throws NOT_FOUND for anything not owned by the actor — knowing an id is never enough.
 */
export async function resolveOwnedMedia(
  ctx: AuthedContext,
  ids: string[],
  purposes: MediaPurpose[],
  contextId?: ObjectId | null,
): Promise<MediaAssetDoc[]> {
  if (!ids.length) return [];
  const objectIds = ids.map((id) => ObjectId.createFromHexString(id));
  const filter: Record<string, unknown> = {
    _id: { $in: objectIds },
    ownerId: ctx.actor.userId,
    status: 'ready',
    purpose: { $in: purposes },
  };
  if (contextId) filter.$or = [{ contextId }, { contextId: null }];
  const docs = await ctx.cols.mediaAssets.find(filter).toArray();
  const byId = new Map(docs.map((d) => [d._id.toHexString(), d]));
  return ids.map((id) => {
    const doc = byId.get(id);
    if (!doc) throw notFound('Media');
    return doc;
  });
}

export async function resolveOwnedMediaEmbed(
  ctx: AuthedContext,
  id: string | null | undefined,
  purposes: MediaPurpose[],
  contextId?: ObjectId | null,
): Promise<MediaEmbed | null | undefined> {
  if (id === undefined) return undefined;
  if (id === null) return null;
  const [doc] = await resolveOwnedMedia(ctx, [id], purposes, contextId);
  return doc ? toEmbed(doc) : null;
}

/** Deletes a media asset from the CDN and marks it deleted. Owner (or platform staff via admin flows) only. */
export async function deleteMedia(ctx: AuthedContext, id: ObjectId, options: { force?: boolean } = {}): Promise<void> {
  const doc = await ctx.cols.mediaAssets.findOne({ _id: id });
  if (!doc || doc.status === 'deleted') throw notFound('Media');
  if (!options.force && !doc.ownerId.equals(ctx.actor.userId)) throw notFound('Media');
  await ctx.cols.mediaAssets.updateOne({ _id: id }, { $set: { status: 'deleting', updatedAt: ctx.now } });
  try {
    if (doc.provider === 'mongo-test') await ctx.db.collection('privateTestMedia').deleteOne({ _id: doc._id });
    else await destroyAsset(doc.publicId, doc.resourceType);
    await ctx.cols.mediaAssets.updateOne({ _id: id }, { $set: { status: 'deleted', updatedAt: new Date() } });
  } catch (error) {
    // Left in "deleting" for the cleanup cron to retry.
    log.warn('media deletion failed; will retry', { mediaId: id.toHexString(), error });
  }
}

/** Fire-and-forget release of replaced media (e.g. old avatar). */
export async function releaseMedia(ctx: AuthedContext, embed: MediaEmbed | null | undefined): Promise<void> {
  if (!embed) return;
  await deleteMedia(ctx, embed.mediaId).catch(() => undefined);
}
