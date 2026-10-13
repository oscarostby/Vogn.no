import type { CrewDetail, MediaPurpose, VehicleDetail } from '@vogn/types';
import type { UploadedMedia } from '@vogn/api-client';
import { ObjectId } from 'mongodb';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as uploadRoute from '@/app/api/v1/media/test-upload/route';
import * as imageRoute from '@/app/api/v1/media/test-image/[id]/route';
import * as deleteRoute from '@/app/api/v1/media/[id]/route';
import * as vehiclesRoute from '@/app/api/v1/vehicles/route';
import * as vehicleRoute from '@/app/api/v1/vehicles/[id]/route';
import * as galleryRoute from '@/app/api/v1/vehicles/[id]/gallery/route';
import * as meRoute from '@/app/api/v1/me/route';
import * as settingsRoute from '@/app/api/v1/me/settings/route';
import * as crewsRoute from '@/app/api/v1/crews/route';
import * as joinRoute from '@/app/api/v1/crews/id/[crewId]/join/route';
import { getEnv, overrideEnvForTests, type Env } from '@/server/env';
import { call, createUser, startHarness, type Harness } from '@/test/harness';

let h: Harness;
let previous: Env;
let image: Buffer;
beforeAll(async () => {
  previous = { ...getEnv() };
  h = await startHarness();
  overrideEnvForTests({ TEST_AUTH_ENABLED: true, TEST_MEDIA_ENABLED: true });
  image = await sharp({ create: { width: 24, height: 16, channels: 3, background: '#c8ff5f' } }).withMetadata().png().toBuffer();
});
afterAll(async () => { overrideEnvForTests(previous); await h?.stop(); });

async function upload(actor: string, purpose: MediaPurpose = 'vehicle', extra: Record<string, unknown> = {}) {
  return call<UploadedMedia>(uploadRoute.POST, { as: actor, body: { purpose, mime: 'image/png', size: image.length, base64: image.toString('base64'), ...extra } });
}

async function read(actor: string | null, id: string) {
  return imageRoute.GET(new Request('http://localhost:3000/api/v1/media/test-image/' + id, {
    headers: actor ? { 'x-test-clerk-user': actor } : {},
  }), { params: Promise.resolve({ id }) });
}

describe('private MongoDB test image storage', () => {
  it('requires both explicit storage and private-auth flags', async () => {
    const owner = await createUser();
    overrideEnvForTests({ TEST_MEDIA_ENABLED: false });
    expect((await upload(owner.clerkId)).status).toBe(503);
    overrideEnvForTests({ TEST_MEDIA_ENABLED: true, TEST_AUTH_ENABLED: false });
    expect((await upload(owner.clerkId)).status).toBe(503);
    overrideEnvForTests({ TEST_AUTH_ENABLED: true });
  });

  it('rejects incorrect sizes, invalid encodings, nonimages and oversized input without storing metadata', async () => {
    const owner = await createUser();
    const before = await h.db.db.collection('privateTestMedia').countDocuments();
    expect((await upload(owner.clerkId, 'vehicle', { size: image.length + 1 })).status).toBe(422);
    expect((await upload(owner.clerkId, 'vehicle', { base64: 'invalid@base64' })).status).toBe(422);
    const text = Buffer.from('this is not an image');
    expect((await upload(owner.clerkId, 'vehicle', { base64: text.toString('base64'), size: text.length })).status).toBe(415);
    expect((await upload(owner.clerkId, 'vehicle', { mime: 'video/mp4' })).status).toBe(415);
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 1);
    expect((await upload(owner.clerkId, 'vehicle', { base64: oversized.toString('base64'), size: oversized.length })).status).toBe(413);
    expect(await h.db.db.collection('privateTestMedia').countDocuments()).toBe(before);
  });

  it('sanitizes decoded images, allows owner reads, and denies anonymous or unrelated reads before attachment', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const uploaded = await upload(owner.clerkId);
    expect(uploaded.status).toBe(200);
    expect(uploaded.data.url).toBe(`/api/v1/media/test-image/${uploaded.data.id}`);
    const stored = await h.db.db.collection('mediaAssets').findOne({ _id: new ObjectId(uploaded.data.id) });
    expect(stored?.provider).toBe('mongo-test');
    const ownRead = await read(owner.clerkId, uploaded.data.id);
    expect(ownRead.status).toBe(200);
    expect(ownRead.headers.get('content-type')).toBe('image/webp');
    expect(ownRead.headers.get('cache-control')).toBe('private, no-store');
    const metadata = await sharp(Buffer.from(await ownRead.arrayBuffer())).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(24);
    expect(metadata.height).toBe(16);
    expect(metadata.exif).toBeUndefined();
    expect((await read(stranger.clerkId, uploaded.data.id)).status).toBe(404);
    expect((await read(null, uploaded.data.id)).status).toBe(401);
  });

  it('allows only the owner to delete and removes both metadata availability and stored bytes', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const uploaded = await upload(owner.clerkId);
    const params = { id: uploaded.data.id };
    expect((await call(deleteRoute.DELETE, { method: 'DELETE', as: stranger.clerkId, params })).status).toBe(404);
    expect((await read(owner.clerkId, uploaded.data.id)).status).toBe(200);
    expect((await call(deleteRoute.DELETE, { method: 'DELETE', as: owner.clerkId, params })).status).toBe(200);
    expect((await read(owner.clerkId, uploaded.data.id)).status).toBe(404);
    expect(await h.db.db.collection('privateTestMedia').findOne({ _id: new ObjectId(uploaded.data.id) })).toBeNull();
  });

  it('enforces actual private vehicle visibility after setGallery attaches a photo', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const vehicle = await call<VehicleDetail>(vehiclesRoute.POST, { as: owner.clerkId, body: { make: 'Toyota', model: 'Supra', visibility: 'private' } });
    expect(vehicle.status).toBe(201);
    const uploaded = await upload(owner.clerkId);
    const params = { id: vehicle.data.id };
    expect((await call(galleryRoute.PUT, { method: 'PUT', as: owner.clerkId, params, body: { mediaIds: [uploaded.data.id] } })).status).toBe(200);
    expect((await read(owner.clerkId, uploaded.data.id)).status).toBe(200);
    expect((await read(stranger.clerkId, uploaded.data.id)).status).toBe(404);
    expect((await call(vehicleRoute.PATCH, { method: 'PATCH', as: owner.clerkId, params, body: { visibility: 'public' } })).status).toBe(200);
    expect((await read(stranger.clerkId, uploaded.data.id)).status).toBe(200);
  });

  it('hides attached profile banners when profile privacy limits the viewer', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const uploaded = await upload(owner.clerkId, 'banner');
    expect((await call(meRoute.PATCH, { method: 'PATCH', as: owner.clerkId, body: { bannerMediaId: uploaded.data.id } })).status).toBe(200);
    expect((await read(stranger.clerkId, uploaded.data.id)).status).toBe(200);
    expect((await call(settingsRoute.PATCH, { method: 'PATCH', as: owner.clerkId, body: { profileVisibility: 'private' } })).status).toBe(200);
    expect((await read(owner.clerkId, uploaded.data.id)).status).toBe(200);
    expect((await read(stranger.clerkId, uploaded.data.id)).status).toBe(404);
  });

  it('keeps an unattached Studio background private even from other crew members', async () => {
    const owner = await createUser();
    const member = await createUser();
    const crew = await call<CrewDetail>(crewsRoute.POST, { as: owner.clerkId, body: { name: 'Media crew', slug: `media-${Math.random().toString(36).slice(2, 10)}`, category: 'jdm', visibility: 'public', template: 'standard', themePreset: 'vogn-minimal' } });
    expect(crew.status).toBe(201);
    expect((await call(joinRoute.POST, { as: member.clerkId, params: { crewId: crew.data.id }, body: {} })).status).toBe(200);
    const uploaded = await upload(owner.clerkId, 'theme_background', { contextId: crew.data.id });
    expect(uploaded.status).toBe(200);
    expect((await read(owner.clerkId, uploaded.data.id)).status).toBe(200);
    expect((await read(member.clerkId, uploaded.data.id)).status).toBe(404);
  });
});
