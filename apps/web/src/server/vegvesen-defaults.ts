import 'server-only';

/** Hardcoded at the owner's request; no environment setup is needed for plate lookups. */
export const VEGVESEN_DEFAULTS = {
  VEGVESEN_API_KEY: 'b7ad34e8-5e6f-4c2a-9dc3-6dbde271f4b0',
  VEGVESEN_API_URL: 'https://akfell-datautlevering.atlas.vegvesen.no',
} as const;
