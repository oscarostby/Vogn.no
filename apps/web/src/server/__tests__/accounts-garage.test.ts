import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as blockRoute from '@/app/api/v1/users/id/[id]/block/route';
import * as connectionRoute from '@/app/api/v1/users/id/[id]/connection/route';
import * as deleteRoute from '@/app/api/v1/me/delete/route';
import * as exportRoute from '@/app/api/v1/me/export/route';
import * as meRoute from '@/app/api/v1/me/route';
import * as onboardingRoute from '@/app/api/v1/me/onboarding/route';
import * as settingsRoute from '@/app/api/v1/me/settings/route';
import * as profileRoute from '@/app/api/v1/users/[username]/route';
import * as garageRoute from '@/app/api/v1/users/[username]/garage/route';
import * as vehicleRoute from '@/app/api/v1/vehicles/[id]/route';
import * as vehiclesRoute from '@/app/api/v1/vehicles/route';
import * as updatesRoute from '@/app/api/v1/vehicles/[id]/updates/route';
import * as modsRoute from '@/app/api/v1/vehicles/[id]/modifications/route';
import { call, createUser, type Harness, startHarness } from '@/test/harness';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h?.stop();
});

describe('authentication & onboarding', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await call(meRoute.PATCH, { method: 'PATCH', body: { bio: 'x' } });
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHENTICATED');
  });

  it('reports onboarding state for new Clerk users', async () => {
    const res = await call<{ needsOnboarding: boolean }>(meRoute.GET, { as: 'user_brand_new' });
    expect(res.status).toBe(200);
    expect(res.data.needsOnboarding).toBe(true);
  });

  it('requires a profile for normal endpoints', async () => {
    const res = await call(vehiclesRoute.POST, { as: 'user_no_profile', body: { make: 'Mazda', model: 'RX-7' } });
    expect(res.body.error?.code).toBe('ONBOARDING_REQUIRED');
  });

  it('creates a profile and rejects duplicate / reserved usernames', async () => {
    const a = await createUser('Kaido_R');
    expect(a.username).toBe('Kaido_R');
    const dup = await call(onboardingRoute.POST, {
      as: 'user_other',
      body: { username: 'kaido_r', displayName: 'Other', acceptTerms: true },
    });
    expect(dup.status).toBe(422);
    const reserved = await call(onboardingRoute.POST, { as: 'user_other2', body: { username: 'admin', displayName: 'x', acceptTerms: true } });
    expect(reserved.status).toBe(422);
    const noTerms = await call(onboardingRoute.POST, { as: 'user_other3', body: { username: 'valid_name', displayName: 'x' } });
    expect(noTerms.status).toBe(422);
  });

  it('blocks cross-origin cookie mutations (CSRF)', async () => {
    const a = await createUser();
    const res = await call(meRoute.PATCH, {
      method: 'PATCH',
      as: a.clerkId,
      body: { bio: 'csrf' },
      headers: { origin: 'https://evil.example' },
    });
    expect(res.status).toBe(403);
  });
});

describe('profiles & privacy', () => {
  it('limits private profiles and never exposes email/phone fields', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    await call(meRoute.PATCH, { method: 'PATCH', as: owner.clerkId, body: { bio: 'Night runs only', country: 'NO' } });
    const publicView = await call<Record<string, unknown>>(profileRoute.GET, { as: viewer.clerkId, params: { username: owner.username } });
    expect(publicView.data.access).toBe('full');
    expect(publicView.data.bio).toBe('Night runs only');
    expect(JSON.stringify(publicView.body)).not.toMatch(/email|phone|clerk/i);

    await call(settingsRoute.PATCH, { method: 'PATCH', as: owner.clerkId, body: { profileVisibility: 'private' } });
    const limited = await call<Record<string, unknown>>(profileRoute.GET, { as: viewer.clerkId, params: { username: owner.username } });
    expect(limited.data.access).toBe('limited');
    expect(limited.data.bio).toBeNull();
    expect(limited.data.country).toBeNull();
  });

  it('connections-only profiles are visible to accepted friends', async () => {
    const a = await createUser();
    const b = await createUser();
    await call(settingsRoute.PATCH, { method: 'PATCH', as: a.clerkId, body: { profileVisibility: 'connections' } });
    expect((await call<Record<string, unknown>>(profileRoute.GET, { as: b.clerkId, params: { username: a.username } })).data.access).toBe('limited');
    await call(connectionRoute.POST, { as: b.clerkId, params: { id: a.id }, body: { action: 'request' } });
    const accepted = await call<{ friendStatus: string }>(connectionRoute.POST, { as: a.clerkId, params: { id: b.id }, body: { action: 'accept' } });
    expect(accepted.data.friendStatus).toBe('friends');
    expect((await call<Record<string, unknown>>(profileRoute.GET, { as: b.clerkId, params: { username: a.username } })).data.access).toBe('full');
  });

  it('hides profiles from users the owner blocked', async () => {
    const a = await createUser();
    const b = await createUser();
    await call(blockRoute.POST, { as: a.clerkId, params: { id: b.id } });
    const res = await call(profileRoute.GET, { as: b.clerkId, params: { username: a.username } });
    expect(res.status).toBe(404);
  });

  it('username changes keep the old handle reserved and redirecting', async () => {
    const a = await createUser();
    const b = await createUser();
    const old = a.username;
    const renamed = await call<{ username: string }>(meRoute.PATCH, { method: 'PATCH', as: a.clerkId, body: { username: `${old}_x` } });
    expect(renamed.status).toBe(200);
    const viaOld = await call<{ username: string }>(profileRoute.GET, { as: b.clerkId, params: { username: old } });
    expect(viaOld.data.username).toBe(`${old}_x`);
    const steal = await call(meRoute.PATCH, { method: 'PATCH', as: b.clerkId, body: { username: old } });
    expect(steal.status).toBe(422);
  });
});

describe('garage', () => {
  it('creates vehicles, stores identifiers encrypted and never returns them', async () => {
    const owner = await createUser();
    const created = await call<{ id: string; viewer: { hasPrivateIdentifiers: boolean } }>(vehiclesRoute.POST, {
      as: owner.clerkId,
      body: {
        make: 'Nissan',
        model: 'Skyline GT-R',
        generation: 'R34',
        year: 1999,
        specs: { originalHp: 280, currentHp: 520 },
        identifiers: { countryCode: 'NO', registrationNumber: 'AB 12345', vin: 'BNR34000123' },
      },
    });
    expect(created.status).toBe(201);
    expect(created.data.viewer.hasPrivateIdentifiers).toBe(true);
    expect(JSON.stringify(created.body)).not.toContain('AB12345');
    const stored = await h.db.db.collection('vehiclePrivate').findOne({});
    expect(stored?.registrationEnc).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain('AB12345');
    expect(JSON.stringify(stored)).not.toContain('BNR34000123');
  });

  it('enforces vehicle visibility and owner-only edits', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const v = await call<{ id: string }>(vehiclesRoute.POST, {
      as: owner.clerkId,
      body: { make: 'Toyota', model: 'Supra', visibility: 'private' },
    });
    const id = v.data.id;
    expect((await call(vehicleRoute.GET, { as: stranger.clerkId, params: { id } })).status).toBe(404);
    expect((await call(vehicleRoute.GET, { params: { id } })).status).toBe(401);
    expect((await call(vehicleRoute.GET, { as: owner.clerkId, params: { id } })).status).toBe(200);
    const garage = await call<unknown[]>(garageRoute.GET, { as: stranger.clerkId, params: { username: owner.username } });
    expect(garage.data).toHaveLength(0);

    await call(vehicleRoute.PATCH, { method: 'PATCH', as: owner.clerkId, params: { id }, body: { visibility: 'public' } });
    expect((await call(vehicleRoute.GET, { as: stranger.clerkId, params: { id } })).status).toBe(200);
    expect((await call(vehicleRoute.GET, { params: { id } })).status).toBe(401);
    const hijack = await call(vehicleRoute.PATCH, { method: 'PATCH', as: stranger.clerkId, params: { id }, body: { nickname: 'mine now' } });
    expect(hijack.status).toBe(403);
    const del = await call(vehicleRoute.DELETE, { method: 'DELETE', as: stranger.clerkId, params: { id } });
    expect(del.status).toBe(403);
  });

  it('supports modifications and build timeline with owner-only expenses', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const v = await call<{ id: string }>(vehiclesRoute.POST, { as: owner.clerkId, body: { make: 'Honda', model: 'Civic Type R' } });
    const id = v.data.id;
    const mods = await call<{ modifications: unknown[] }>(modsRoute.PUT, {
      method: 'PUT',
      as: owner.clerkId,
      params: { id },
      body: {
        categories: [{ id: 'turbo', name: 'Turbo', builtIn: 'turbo' }, { id: 'custom1', name: 'Track aero', builtIn: null }],
        modifications: [
          { id: 'm1', categoryId: 'turbo', name: 'Garrett G25-550', brand: 'Garrett', fields: [{ key: 'Boost', value: '1.6 bar' }] },
          { id: 'm2', categoryId: 'custom1', name: 'Rear wing' },
        ],
      },
    });
    expect(mods.data.modifications).toHaveLength(2);
    const badMods = await call(modsRoute.PUT, {
      method: 'PUT',
      as: owner.clerkId,
      params: { id },
      body: { categories: [], modifications: [{ id: 'x', categoryId: 'nope', name: 'x' }] },
    });
    expect(badMods.status).toBe(422);

    await call(updatesRoute.POST, {
      as: owner.clerkId,
      params: { id },
      body: { kind: 'modification', title: 'Turbo install', occurredAt: new Date().toISOString(), cost: { amount: 25000, currency: 'NOK' } },
    });
    const asOwner = await call<{ cost: unknown }[]>(updatesRoute.GET, { as: owner.clerkId, params: { id } });
    expect(asOwner.data[0]?.cost).toEqual({ amount: 25000, currency: 'NOK' });
    const asViewer = await call<{ cost: unknown }[]>(updatesRoute.GET, { as: viewer.clerkId, params: { id } });
    expect(asViewer.data[0]?.cost).toBeNull();
  });
});

describe('account lifecycle', () => {
  it('exports personal data and deletes the account', async () => {
    const a = await createUser();
    const viewer = await createUser();
    const v = await call<{ id: string }>(vehiclesRoute.POST, { as: a.clerkId, body: { make: 'BMW', model: 'M3', visibility: 'public' } });
    const exported = await exportRoute.GET(
      new Request('http://localhost:3000/api/v1/me/export', { headers: { 'x-test-clerk-user': a.clerkId } }),
      { params: Promise.resolve({}) },
    );
    const json = (await exported.json()) as { format: string; vehicles: unknown[] };
    expect(json.format).toBe('vogn-export/v1');
    expect(json.vehicles).toHaveLength(1);

    const wrong = await call(deleteRoute.POST, { as: a.clerkId, body: { confirmUsername: 'nope' } });
    expect(wrong.status).toBe(422);
    const ok = await call(deleteRoute.POST, { as: a.clerkId, body: { confirmUsername: a.username } });
    expect(ok.status).toBe(200);
    expect((await call(vehicleRoute.GET, { as: viewer.clerkId, params: { id: v.data.id } })).status).toBe(404);
    expect((await call(profileRoute.GET, { as: viewer.clerkId, params: { username: a.username } })).status).toBe(404);
    const me = await call<{ needsOnboarding?: boolean }>(meRoute.GET, { as: a.clerkId });
    expect(me.data.needsOnboarding).toBe(true);
  });
});
