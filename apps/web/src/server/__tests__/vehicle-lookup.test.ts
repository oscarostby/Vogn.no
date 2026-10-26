import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as lookupRoute from '@/app/api/v1/vehicles/lookup/route';
import { getEnv, overrideEnvForTests, type Env } from '@/server/env';
import { normalizeVegvesenVehicle } from '@/server/integrations/vegvesen';
import { vehicleAutofill } from '@/lib/vehicle-autofill';
import { call, createUser, startHarness, type Harness } from '@/test/harness';

const registryVehicle = () => ({
  kjoretoydataListe: [{
    kjoretoyId: { kjennemerke: 'AB12345', understellsnummer: 'SECRET_VIN' },
    godkjenning: {
      forstegangsGodkjenning: { forstegangRegistrertDato: '2008-11-24' },
      tekniskGodkjenning: { tekniskeData: {
        generelt: { merke: [{ merke: 'SUBARU' }], handelsbetegnelse: ['IMPREZA'], typebetegnelse: 'G3' },
        karosseriOgLasteplan: { rFarge: [{ kodeNavn: 'Sølv' }] },
        motorOgDrivverk: { girkassetype: { kodeVerdi: 'A' }, motor: [{ motorKode: 'EJ20', slagvolum: 1994, drivstoff: [{ drivstoffKode: { kodeNavn: 'Bensin' }, maksNettoEffekt: 110 }] }] },
        akslinger: { akselGruppe: [{ akselListe: { aksel: [{ plasseringAksel: '1', drivAksel: true }, { plasseringAksel: '2', drivAksel: true }] } }] },
        vekter: { egenvekt: 1435 }, persontall: { sitteplasserTotalt: 5 },
      } },
    },
  }],
});
let h: Harness;
let previous: Env;
let user: Awaited<ReturnType<typeof createUser>>;
const fetchMock = vi.fn<typeof fetch>();

beforeAll(async () => {
  previous = { ...getEnv() };
  h = await startHarness();
  user = await createUser();
  overrideEnvForTests({ VEGVESEN_API_KEY: 'isolated-provider-key' });
});
afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockReset(); });
afterAll(async () => { overrideEnvForTests(previous); await h?.stop(); });

describe('Norwegian vehicle lookup', () => {
  it('normalizes actual registry structure and never returns raw identifiers', () => {
    const official = normalizeVegvesenVehicle(registryVehicle());
    expect(official).toMatchObject({ make: 'SUBARU', model: 'IMPREZA', fuel: 'petrol', powerKw: 110, engine: 'EJ20', displacementCc: 1994, gearbox: 'automatic', drivetrain: 'awd', weightKg: 1435 });
    expect(JSON.stringify(official)).not.toMatch(/SECRET_VIN|AB12345|understellsnummer|kjennemerke/);
    expect(vehicleAutofill(official)).toMatchObject({ make: 'SUBARU', model: 'IMPREZA', year: 2008, transmission: 'automatic', specs: { originalHp: 150, engine: 'EJ20', displacementCc: 1994 } });
    expect(vehicleAutofill(official).specs).not.toHaveProperty('currentHp');
  });

  it('handles sparse data without replacing values with guesses', () => {
    const official = normalizeVegvesenVehicle({ kjoretoydataListe: [{ godkjenning: { tekniskGodkjenning: { tekniskeData: { generelt: { merke: [{ merke: 'TESLA' }], handelsbetegnelse: ['MODEL 3'] }, motorOgDrivverk: { utelukkendeElektriskDrift: true } } } } }] });
    expect(official.fuel).toBe('electric');
    const patch = vehicleAutofill(official);
    expect(patch).not.toHaveProperty('year');
    expect(patch).not.toHaveProperty('drivetrain');
    expect(patch.specs).not.toHaveProperty('displacementCc');
    expect(() => normalizeVegvesenVehicle({ kjoretoydataListe: [] })).toThrow('Vehicle not found');
  });

  it('requires authentication and a completed profile before contacting the provider', async () => {
    vi.stubGlobal('fetch', fetchMock);
    expect((await call(lookupRoute.POST, { body: { countryCode: 'NO', registrationNumber: 'AB12345' } })).status).toBe(401);
    expect((await call(lookupRoute.POST, { as: 'user_no_profile', body: { countryCode: 'NO', registrationNumber: 'AB12345' } })).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes plate input and authenticates to the documented endpoint', async () => {
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(Response.json(registryVehicle())));
    const result = await call(lookupRoute.POST, { as: user.clerkId, body: { countryCode: 'NO', registrationNumber: 'ab 12345' } });
    expect(result.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata?kjennemerke=AB12345');
    expect(options?.headers).toMatchObject({ 'SVV-Authorization': 'Apikey isolated-provider-key' });
    expect(options?.cache).toBe('no-store');
  });

  it('rejects unsupported countries and malformed registration numbers', async () => {
    vi.stubGlobal('fetch', fetchMock);
    for (const body of [{ countryCode: 'SE', registrationNumber: 'ABC123' }, { countryCode: 'NO', registrationNumber: '../secret' }]) {
      expect((await call(lookupRoute.POST, { as: user.clerkId, body })).status).toBe(422);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns helpful failures for missing vehicles, provider quotas and outages', async () => {
    vi.stubGlobal('fetch', fetchMock);
    const body = { countryCode: 'NO', registrationNumber: 'AB12345' };
    for (const [providerStatus, expected] of [[204, 404], [422, 429], [503, 502]] as const) {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: providerStatus }));
      expect((await call(lookupRoute.POST, { as: user.clerkId, body })).status).toBe(expected);
    }
    fetchMock.mockRejectedValueOnce(new Error('network failure'));
    expect((await call(lookupRoute.POST, { as: user.clerkId, body })).status).toBe(502);
  });
});
