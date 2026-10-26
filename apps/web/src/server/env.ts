import 'server-only';
import { z } from 'zod';
import { PRIVATE_TEST_DEFAULTS } from './private-test-defaults';
import { VEGVESEN_DEFAULTS } from './vegvesen-defaults';
import { CLERK_DEFAULTS } from './clerk-defaults';
import { PUBLIC_DEFAULTS } from '../config/public-defaults';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  MONGODB_URI: optional,
  MONGODB_DB: z.string().default('vogn'),
  MONGODB_TRANSACTIONS: bool(true),

  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optional,
  NEXT_PUBLIC_CLERK_ENABLED: bool(true),
  CLERK_SECRET_KEY: optional,
  CLERK_WEBHOOK_SIGNING_SECRET: optional,
  CLERK_AUTHORIZED_PARTIES: csv,

  /** Explicit, password-gated private testing mode. Never enabled by missing Clerk keys. */
  TEST_AUTH_ENABLED: bool(false),
  NEXT_PUBLIC_TEST_AUTH_ENABLED: bool(false),
  TEST_AUTH_PASSWORD: optional,
  /** Compatibility only. Public account registration never needs a shared password. */
  LEGACY_TEST_AUTH_ENABLED: bool(false),
  TEST_MEDIA_ENABLED: bool(false),

  ABLY_API_KEY: optional,

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('vogn'),

  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,

  /** base64-encoded 32-byte key for AES-256-GCM field encryption. */
  DATA_ENCRYPTION_KEY: optional,
  /** ≥32 random characters; signs upload tokens and other short-lived server tokens. */
  APP_SIGNING_SECRET: optional,

  VEGVESEN_API_KEY: optional,
  VEGVESEN_API_URL: z.string().url().default('https://akfell-datautlevering.atlas.vegvesen.no'),

  LIVEKIT_URL: optional,
  LIVEKIT_API_KEY: optional,
  LIVEKIT_API_SECRET: optional,

  UPSTASH_REDIS_REST_URL: optional,
  UPSTASH_REDIS_REST_TOKEN: optional,

  CRON_SECRET: optional,
  PLATFORM_ADMIN_CLERK_IDS: csv,
  EXPO_ACCESS_TOKEN: optional,

  VERIFICATION_EVIDENCE_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  FEATURE_VOICE: bool(true),
  FEATURE_MARKETPLACE: bool(true),
  FEATURE_PUSH: bool(true),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Explicit committed private-test defaults; isolated tests never inherit the real database or keys. */
export function environmentInput(raw: Record<string, string | undefined> = process.env) {
  const configured = Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined && value !== ''));
  if (raw.NODE_ENV === 'test') return configured;
  const appUrl = raw.NEXT_PUBLIC_APP_URL || (raw.VERCEL_URL ? `https://${raw.VERCEL_URL}` : raw.NODE_ENV === 'production' ? PUBLIC_DEFAULTS.appUrl : 'http://localhost:3000');
  return {
    ...PRIVATE_TEST_DEFAULTS, ...VEGVESEN_DEFAULTS,
    ...(raw.NEXT_PUBLIC_CLERK_ENABLED === 'false' ? {} : CLERK_DEFAULTS),
    ...configured, NEXT_PUBLIC_APP_URL: appUrl,
  };
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(environmentInput());
  if (!parsed.success) {
    // Fail loudly with names only — never echo values.
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test hook: override env values without touching process.env. */
export function overrideEnvForTests(values: Partial<Env>): void {
  cached = { ...getEnv(), ...values };
}

export type Integration =
  | 'database'
  | 'auth'
  | 'realtime'
  | 'media'
  | 'privateStorage'
  | 'encryption'
  | 'signing'
  | 'vehicleLookupNO'
  | 'voice'
  | 'redisRateLimit'
  | 'cron'
  | 'clerkWebhooks';

export const INTEGRATION_VARS: Record<Integration, (keyof Env)[]> = {
  database: ['MONGODB_URI'],
  auth: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
  realtime: ['ABLY_API_KEY'],
  media: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
  privateStorage: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'],
  encryption: ['DATA_ENCRYPTION_KEY'],
  signing: ['APP_SIGNING_SECRET'],
  vehicleLookupNO: ['VEGVESEN_API_KEY'],
  voice: ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'],
  redisRateLimit: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  cron: ['CRON_SECRET'],
  clerkWebhooks: ['CLERK_WEBHOOK_SIGNING_SECRET'],
};

export function missingVars(integration: Integration, env: Env = getEnv()): string[] {
  if (integration === 'auth' && env.TEST_AUTH_ENABLED) {
    const missing: string[] = [];
    if (!env.NEXT_PUBLIC_TEST_AUTH_ENABLED) missing.push('NEXT_PUBLIC_TEST_AUTH_ENABLED');
    if (!env.TEST_AUTH_PASSWORD || env.TEST_AUTH_PASSWORD.length < 16) missing.push('TEST_AUTH_PASSWORD');
    if (!env.APP_SIGNING_SECRET || env.APP_SIGNING_SECRET.length < 32) missing.push('APP_SIGNING_SECRET');
    return missing;
  }
  return INTEGRATION_VARS[integration].filter((key) => !env[key]);
}

export function isConfigured(integration: Integration, env: Env = getEnv()): boolean {
  return missingVars(integration, env).length === 0;
}

export function clerkAuthConfigured(env: Env = getEnv()): boolean {
  return env.NEXT_PUBLIC_CLERK_ENABLED && Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

export const REQUIRED_INTEGRATIONS: Integration[] = ['database', 'auth', 'encryption', 'signing'];

export function integrationStatus(env: Env = getEnv()) {
  return (Object.keys(INTEGRATION_VARS) as Integration[]).map((name) => ({
    name,
    configured: name === 'media' && env.TEST_MEDIA_ENABLED && env.TEST_AUTH_ENABLED ? true : isConfigured(name, env),
    required: REQUIRED_INTEGRATIONS.includes(name),
    missing: name === 'media' && env.TEST_MEDIA_ENABLED && env.TEST_AUTH_ENABLED ? [] : missingVars(name, env),
  }));
}
