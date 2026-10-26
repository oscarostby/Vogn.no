import 'server-only';
import type { OfficialVehicleData } from '@vogn/types';
import { z } from 'zod';
import { getEnv, missingVars } from '../env';
import { AppError, badRequest, configMissing, notFound, providerError } from '../errors';

const code = z.object({ kodeNavn: z.string().optional(), kodeVerdi: z.string().optional() });
const fuel = z.object({ drivstoffKode: code.optional(), maksNettoEffekt: z.number().optional() });
const motor = z.object({ motorKode: z.string().optional(), slagvolum: z.number().optional(), drivstoff: z.array(fuel).optional() });
const axle = z.object({ drivAksel: z.boolean().optional(), plasseringAksel: z.string().optional() });
const technical = z.object({
  generelt: z.object({
    merke: z.array(z.object({ merke: z.string().optional() })).optional(),
    handelsbetegnelse: z.array(z.string()).optional(), typebetegnelse: z.string().optional(),
  }).optional(),
  karosseriOgLasteplan: z.object({ rFarge: z.array(code).optional(), karosseritype: code.optional() }).optional(),
  motorOgDrivverk: z.object({
    girkassetype: code.optional(), motor: z.array(motor).optional(),
    hybridElektriskKjoretoy: z.boolean().optional(), hybridKategori: code.optional(), utelukkendeElektriskDrift: z.boolean().optional(),
  }).optional(),
  akslinger: z.object({ akselGruppe: z.array(z.object({ akselListe: z.object({ aksel: z.array(axle).optional() }).optional() })).optional() }).optional(),
  vekter: z.object({ egenvekt: z.number().optional() }).optional(),
  persontall: z.object({ sitteplasserTotalt: z.number().optional() }).optional(),
});
const responseSchema = z.object({
  kjoretoydataListe: z.array(z.object({
    forstegangsregistrering: z.object({ registrertForstegangNorgeDato: z.string().optional() }).optional(),
    godkjenning: z.object({
      forstegangsGodkjenning: z.object({ forstegangRegistrertDato: z.string().optional() }).optional(),
      tekniskGodkjenning: z.object({ tekniskeData: technical.optional() }).optional(),
    }).optional(),
  })).optional(),
});

function fuelType(drive: z.infer<typeof technical>['motorOgDrivverk']): string | null {
  if (!drive) return null;
  const names = (drive.motor ?? []).flatMap((item) => (item.drivstoff ?? []).map((item) => item.drivstoffKode?.kodeNavn?.toLowerCase() ?? ''));
  const hybrid = `${drive.hybridKategori?.kodeVerdi ?? ''} ${drive.hybridKategori?.kodeNavn ?? ''}`.toLowerCase();
  if (/ovc|plug|ladbar/.test(hybrid)) return 'plugin_hybrid';
  const electric = drive.utelukkendeElektriskDrift || names.some((name) => /elektr/.test(name));
  const combustion = names.some((name) => /bensin|diesel/.test(name));
  if (drive.hybridElektriskKjoretoy || (electric && combustion)) return 'hybrid';
  if (electric) return 'electric';
  if (names.some((name) => /diesel/.test(name))) return 'diesel';
  if (names.some((name) => /bensin/.test(name))) return 'petrol';
  if (names.some((name) => /hydrogen/.test(name))) return 'hydrogen';
  return null;
}

function gearbox(value: z.infer<typeof code> | undefined): string | null {
  const name = value?.kodeNavn?.toLowerCase() ?? '';
  if (/dct|dobbelt|dual/.test(name)) return 'dct';
  if (/cvt|trinnløs|trinnlos/.test(name)) return 'cvt';
  if (/manuell|manual/.test(name) || value?.kodeVerdi === 'M') return 'manual';
  if (/automat/.test(name) || value?.kodeVerdi === 'A') return 'automatic';
  return null;
}

/** Explicit allowlist: registration numbers, VINs and other raw registry data never leave this adapter. */
export function normalizeVegvesenVehicle(payload: unknown): OfficialVehicleData {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw providerError('Statens vegvesen', 'The vehicle response could not be read. Please try again.');
  const vehicle = parsed.data.kjoretoydataListe?.[0];
  if (!vehicle) throw notFound('Vehicle');
  const data = vehicle.godkjenning?.tekniskGodkjenning?.tekniskeData;
  if (!data?.generelt) throw providerError('Statens vegvesen', 'Technical information is unavailable for this vehicle.');
  const engines = data.motorOgDrivverk?.motor ?? [];
  const power = engines.flatMap((item) => (item.drivstoff ?? []).map((item) => item.maksNettoEffekt)).filter((value): value is number => typeof value === 'number' && value > 0);
  const axles = (data.akslinger?.akselGruppe ?? []).flatMap((group) => group.akselListe?.aksel ?? []);
  const driven = axles.filter((item) => item.drivAksel === true);
  const drivetrain = axles.length === 2 && axles.every((item) => typeof item.drivAksel === 'boolean')
    ? driven.length === 2 ? 'awd' : driven.length === 1 ? driven[0]?.plasseringAksel === '1' ? 'fwd' : driven[0]?.plasseringAksel === '2' ? 'rwd' : null : null
    : null;
  return {
    provider: 'Statens vegvesen', countryCode: 'NO', fetchedAt: new Date().toISOString(),
    make: data.generelt.merke?.[0]?.merke ?? null,
    model: data.generelt.handelsbetegnelse?.[0] ?? null,
    variant: data.generelt.typebetegnelse ?? null,
    bodyType: data.karosseriOgLasteplan?.karosseritype?.kodeNavn ?? null,
    color: data.karosseriOgLasteplan?.rFarge?.map((item) => item.kodeNavn).filter(Boolean).join(' / ') || null,
    fuel: fuelType(data.motorOgDrivverk), powerKw: power.length ? Math.max(...power) : null,
    engine: engines.find((item) => item.motorKode)?.motorKode ?? null,
    displacementCc: engines.find((item) => item.slagvolum && item.slagvolum > 0)?.slagvolum ?? null,
    gearbox: gearbox(data.motorOgDrivverk?.girkassetype), drivetrain,
    firstRegistration: vehicle.godkjenning?.forstegangsGodkjenning?.forstegangRegistrertDato ?? vehicle.forstegangsregistrering?.registrertForstegangNorgeDato ?? null,
    modelYear: null, seats: data.persontall?.sitteplasserTotalt ?? null, weightKg: data.vekter?.egenvekt ?? null,
  };
}

export async function lookupNorwegianVehicle(countryCode: string, registrationNumber: string): Promise<OfficialVehicleData> {
  if (countryCode !== 'NO') throw badRequest('Plate lookup is available for Norwegian vehicles. Other vehicles can be entered manually.');
  const env = getEnv();
  if (!env.VEGVESEN_API_KEY) throw configMissing('Statens vegvesen', missingVars('vehicleLookupNO'));
  const url = new URL('/enkeltoppslag/kjoretoydata', env.VEGVESEN_API_URL);
  url.searchParams.set('kjennemerke', registrationNumber);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'SVV-Authorization': `Apikey ${env.VEGVESEN_API_KEY}`, Accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw providerError('Statens vegvesen', 'Vehicle lookup is temporarily unavailable. Try again or enter the details manually.');
  }
  if (response.status === 204 || response.status === 404) throw notFound('Vehicle');
  if (response.status === 400) throw badRequest('Check the registration number and try again.');
  if (response.status === 429 || response.status === 422) throw new AppError('RATE_LIMITED', 'The vehicle lookup quota has been reached. Please try again later.', undefined, { 'Retry-After': response.headers.get('retry-after') ?? '3600' });
  if (!response.ok) throw providerError('Statens vegvesen', 'Vehicle lookup is temporarily unavailable. Try again or enter the details manually.');
  let payload: unknown;
  try { payload = await response.json(); } catch { throw providerError('Statens vegvesen', 'The vehicle response could not be read. Please try again.'); }
  return normalizeVegvesenVehicle(payload);
}
