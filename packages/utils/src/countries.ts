/** ISO 3166-1 alpha-2 codes offered in profile / crew / event country pickers. */
export const COUNTRY_CODES = [
  'AE', 'AR', 'AT', 'AU', 'BA', 'BE', 'BG', 'BH', 'BR', 'CA', 'CH', 'CL', 'CN', 'CO', 'CY', 'CZ', 'DE', 'DK',
  'EE', 'EG', 'ES', 'FI', 'FO', 'FR', 'GB', 'GE', 'GL', 'GR', 'HK', 'HR', 'HU', 'ID', 'IE', 'IL', 'IN', 'IS',
  'IT', 'JO', 'JP', 'KR', 'KW', 'KZ', 'LB', 'LI', 'LT', 'LU', 'LV', 'MA', 'MC', 'MD', 'ME', 'MK', 'MT', 'MX',
  'MY', 'NL', 'NO', 'NZ', 'OM', 'PE', 'PH', 'PK', 'PL', 'PT', 'QA', 'RO', 'RS', 'SA', 'SE', 'SG', 'SI', 'SK',
  'TH', 'TN', 'TR', 'TW', 'UA', 'US', 'UY', 'VN', 'ZA',
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

export function countryName(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
