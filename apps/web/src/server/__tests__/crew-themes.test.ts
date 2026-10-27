import { presetManifest, type ThemeManifest } from '@vogn/theme-engine';
import type { CrewDetail } from '@vogn/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as crewsRoute from '@/app/api/v1/crews/route';
import * as joinRoute from '@/app/api/v1/crews/id/[crewId]/join/route';
import * as publishedRoute from '@/app/api/v1/crews/id/[crewId]/theme/route';
import * as draftRoute from '@/app/api/v1/crews/id/[crewId]/theme/draft/route';
import * as publishRoute from '@/app/api/v1/crews/id/[crewId]/theme/publish/route';
import * as versionsRoute from '@/app/api/v1/crews/id/[crewId]/theme/versions/route';
import * as versionRoute from '@/app/api/v1/crews/id/[crewId]/theme/versions/[version]/route';
import * as restoreRoute from '@/app/api/v1/crews/id/[crewId]/theme/versions/[version]/restore/route';
import { call, createUser, startHarness, type Harness } from '@/test/harness';

let h: Harness;
beforeAll(async () => { h = await startHarness(); });
afterAll(async () => { await h?.stop(); });

interface ThemeState {
  draft: ThemeManifest;
  published: ThemeManifest;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
}

async function crew(owner: string, visibility: 'public' | 'hidden' = 'public') {
  const result = await call<CrewDetail>(crewsRoute.POST, {
    as: owner,
    body: { name: 'Theme test crew', slug: `theme-${Math.random().toString(36).slice(2, 10)}`, category: 'jdm', visibility, template: 'standard', themePreset: 'vogn-minimal' },
  });
  expect(result.status).toBe(201);
  return result.data;
}

describe('crew theme draft and publish authorization', () => {
  it('restricts Studio drafts and mutations to members with MANAGE_THEMES', async () => {
    const owner = await createUser();
    const member = await createUser();
    const outsider = await createUser();
    const target = await crew(owner.clerkId);
    const params = { crewId: target.id };
    expect((await call(joinRoute.POST, { as: member.clerkId, params, body: {} })).status).toBe(200);
    expect((await call(draftRoute.GET, { as: owner.clerkId, params })).status).toBe(200);
    for (const actor of [member.clerkId, outsider.clerkId]) {
      expect((await call(draftRoute.GET, { as: actor, params })).status).toBe(403);
      expect((await call(draftRoute.PUT, { method: 'PUT', as: actor, params, body: { manifest: presetManifest('tokyo-midnight') } })).status).toBe(403);
      expect((await call(publishRoute.POST, { as: actor, params, body: {} })).status).toBe(403);
      expect((await call(versionsRoute.GET, { as: actor, params })).status).toBe(403);
    }
    expect((await call(publishedRoute.GET, { as: outsider.clerkId, params })).status).toBe(200);
  });

  it('rejects invalid manifests before changing either draft or publication', async () => {
    const owner = await createUser();
    const target = await crew(owner.clerkId);
    const params = { crewId: target.id };
    const before = await call<ThemeState>(draftRoute.GET, { as: owner.clerkId, params });
    const invalid = presetManifest('tokyo-midnight');
    const badColor = await call(draftRoute.PUT, { method: 'PUT', as: owner.clerkId, params, body: { manifest: { ...invalid, colors: { ...invalid.colors, accent: 'javascript:alert(1)' } } } });
    expect(badColor.status).toBe(422);
    const badImage = await call(draftRoute.PUT, { method: 'PUT', as: owner.clerkId, params, body: { manifest: { ...invalid, background: { ...invalid.background, type: 'image', imageUrl: 'https://attacker.example/image.svg' } } } });
    expect(badImage.status).toBe(422);
    const after = await call<ThemeState>(draftRoute.GET, { as: owner.clerkId, params });
    expect(after.data).toEqual(before.data);
  });

  it('keeps the published snapshot unchanged until publish creates an immutable next version', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const target = await crew(owner.clerkId);
    const params = { crewId: target.id };
    const original = await call<{ manifest: ThemeManifest; version: number }>(publishedRoute.GET, { as: viewer.clerkId, params });
    const next = presetManifest('tokyo-midnight');
    const saved = await call<ThemeState>(draftRoute.PUT, { method: 'PUT', as: owner.clerkId, params, body: { manifest: next } });
    expect(saved.status).toBe(200);
    expect(saved.data.hasUnpublishedChanges).toBe(true);
    expect((await call(publishedRoute.GET, { as: viewer.clerkId, params })).data).toEqual(original.data);
    const published = await call<ThemeState>(publishRoute.POST, { as: owner.clerkId, params, body: { note: 'First custom look' } });
    expect(published.status).toBe(200);
    expect(published.data.publishedVersion).toBe(2);
    expect(published.data.hasUnpublishedChanges).toBe(false);
    expect(published.data.published.meta.name).toBe(next.meta.name);
    const firstVersion = await call<ThemeManifest>(versionRoute.GET, { as: owner.clerkId, params: { ...params, version: '1' } });
    expect(firstVersion.data).toEqual(original.data.manifest);
  });

  it('restores drafts independently and records published restorations as new history entries', async () => {
    const owner = await createUser();
    const target = await crew(owner.clerkId);
    const params = { crewId: target.id };
    const original = presetManifest('vogn-minimal');
    const second = presetManifest('tokyo-midnight');
    expect((await call(draftRoute.PUT, { method: 'PUT', as: owner.clerkId, params, body: { manifest: second } })).status).toBe(200);
    expect((await call(publishRoute.POST, { as: owner.clerkId, params, body: {} })).status).toBe(200);
    const restoredDraft = await call<ThemeState>(restoreRoute.POST, { as: owner.clerkId, params: { ...params, version: '1' }, body: { publish: false } });
    expect(restoredDraft.status).toBe(200);
    expect(restoredDraft.data.draft.meta.name).toBe(original.meta.name);
    expect(restoredDraft.data.published.meta.name).toBe(second.meta.name);
    expect(restoredDraft.data.publishedVersion).toBe(2);
    const restoredLive = await call<ThemeState>(restoreRoute.POST, { as: owner.clerkId, params: { ...params, version: '1' }, body: { publish: true } });
    expect(restoredLive.status).toBe(200);
    expect(restoredLive.data.publishedVersion).toBe(3);
    expect(restoredLive.data.published.meta.name).toBe(original.meta.name);
    const history = await call<Array<{ version: number; restoredFrom: number | null }>>(versionsRoute.GET, { as: owner.clerkId, params });
    expect(history.data.map((item) => item.version)).toEqual([3, 2, 1]);
    expect(history.data[0]!.restoredFrom).toBe(1);
    const storedSecond = await call<ThemeManifest>(versionRoute.GET, { as: owner.clerkId, params: { ...params, version: '2' } });
    expect(storedSecond.data.meta.name).toBe(second.meta.name);
  });

  it('hides published themes and draft existence for hidden crews', async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const target = await crew(owner.clerkId, 'hidden');
    const params = { crewId: target.id };
    expect((await call(publishedRoute.GET, { as: owner.clerkId, params })).status).toBe(200);
    expect((await call(publishedRoute.GET, { as: outsider.clerkId, params })).status).toBe(404);
    expect((await call(publishedRoute.GET, { params })).status).toBe(401);
    expect((await call(draftRoute.GET, { as: outsider.clerkId, params })).status).toBe(404);
  });

  it('reports invalid version parameters as validation errors and missing versions as 404', async () => {
    const owner = await createUser();
    const target = await crew(owner.clerkId);
    const params = { crewId: target.id };
    for (const version of ['NaN', '0', '1.1']) {
      expect((await call(versionRoute.GET, { as: owner.clerkId, params: { ...params, version } })).status).toBe(422);
      expect((await call(restoreRoute.POST, { as: owner.clerkId, params: { ...params, version }, body: { publish: true } })).status).toBe(422);
    }
    expect((await call(versionRoute.GET, { as: owner.clerkId, params: { ...params, version: '99' } })).status).toBe(404);
  });
});
