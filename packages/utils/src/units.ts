export type UnitSystem = 'metric' | 'imperial';

const KW_PER_HP = 0.745699872;
const LBFT_PER_NM = 0.737562149;
const MI_PER_KM = 0.621371192;

export const hpToKw = (hp: number) => hp * KW_PER_HP;
export const kwToHp = (kw: number) => kw / KW_PER_HP;
export const nmToLbft = (nm: number) => nm * LBFT_PER_NM;
export const lbftToNm = (lbft: number) => lbft / LBFT_PER_NM;
export const kmToMi = (km: number) => km * MI_PER_KM;
export const miToKm = (mi: number) => mi / MI_PER_KM;

/** Power is stored in horsepower (hp, mechanical). Metric users additionally see kW. */
export function formatPower(hp: number, system: UnitSystem, locale = 'en'): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return system === 'metric' ? `${nf.format(hp)} hp (${nf.format(hpToKw(hp))} kW)` : `${nf.format(hp)} hp`;
}

/** Torque is stored in Nm. */
export function formatTorque(nm: number, system: UnitSystem, locale = 'en'): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return system === 'metric' ? `${nf.format(nm)} Nm` : `${nf.format(nmToLbft(nm))} lb-ft`;
}

/** Distances are stored in km. */
export function formatDistance(km: number, system: UnitSystem, locale = 'en'): string {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return system === 'metric' ? `${nf.format(km)} km` : `${nf.format(kmToMi(km))} mi`;
}

export function defaultUnitsForCountry(countryCode: string | null | undefined): UnitSystem {
  return countryCode && ['US', 'LR', 'MM', 'GB'].includes(countryCode.toUpperCase()) ? 'imperial' : 'metric';
}
