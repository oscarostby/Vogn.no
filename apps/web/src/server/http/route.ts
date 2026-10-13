import 'server-only';
import { negotiateLocale } from '@vogn/i18n';
import type { ApiErrorBody, ApiSuccessBody } from '@vogn/types';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { type ZodType, z } from 'zod';
import { resolveAuth } from '../auth';
import { createContext, type ServiceContext } from '../context';
import { requestFingerprint } from '../crypto';
import { type Database, getDatabase } from '../db';
import { getEnv } from '../env';
import { AppError, forbidden, unauthenticated, validationError } from '../errors';
import { log } from '../log';
import { enforceRateLimit, RATE_LIMITS, type RateLimitRule } from '../rate-limit';

export class Ok<T> {
  constructor(
    readonly data: T,
    readonly meta?: ApiSuccessBody<T>['meta'],
    readonly status = 200,
  ) {}
}

export const ok = <T>(data: T, meta?: ApiSuccessBody<T>['meta']) => new Ok(data, meta);
export const created = <T>(data: T) => new Ok(data, undefined, 201);
export const paginated = <T>(items: T[], nextCursor: string | null) => new Ok(items, { nextCursor });

type AuthMode = 'required' | 'optional' | 'none' | 'cron';

export interface RouteConfig<B, Q> {
  auth: AuthMode;
  /** Allow authenticated Clerk users without a VOGN profile (onboarding endpoints). Default false. */
  allowWithoutProfile?: boolean;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  rateLimit?: RateLimitRule;
  /** Max JSON body size in bytes (default 256 KB). */
  maxBodyBytes?: number;
}

export interface HandlerArgs<P, B, Q> {
  req: Request;
  params: P;
  body: B;
  query: Q;
  ctx: ServiceContext;
  clerkUserId: string | null;
  requestId: string;
}

/** Loose segment typing so handlers satisfy Next.js generated route types for any dynamic segments. */
type SegmentParams = Record<string, string | string[] | undefined>;

type Handler<P, B, Q> = (args: HandlerArgs<P, B, Q>) => Promise<unknown>;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function allowedOrigins(): Set<string> {
  const env = getEnv();
  const origins = new Set<string>([new URL(env.NEXT_PUBLIC_APP_URL).origin]);
  for (const party of env.CLERK_AUTHORIZED_PARTIES) {
    try {
      origins.add(new URL(party).origin);
    } catch {
      // ignore malformed entries
    }
  }
  return origins;
}

/**
 * CSRF defence for cookie-authenticated requests. Bearer-token requests (mobile) are not vulnerable to CSRF
 * because browsers never attach them automatically.
 */
function checkOrigin(req: Request): void {
  if (!MUTATING.has(req.method)) return;
  if (req.headers.get('authorization')?.startsWith('Bearer ')) return;
  const origin = req.headers.get('origin');
  const requestOrigin = new URL(req.url).origin;
  if (origin) {
    if (origin !== requestOrigin && !allowedOrigins().has(origin)) throw forbidden('Cross-origin request blocked.');
    return;
  }
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw forbidden('Cross-site request blocked.');
}

function clientIp(req: Request): string | null {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

function json(body: unknown, status: number, requestId: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
      ...headers,
    },
  });
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: error.code, message: error.message, details: error.details, requestId },
    };
    return json(body, error.status, requestId, error.headers);
  }
  log.error('Unhandled API error', { requestId, error });
  const body: ApiErrorBody = { error: { code: 'INTERNAL', message: 'Internal server error.', requestId } };
  return json(body, 500, requestId);
}

async function readBody(req: Request, maxBytes: number): Promise<unknown> {
  if (!MUTATING.has(req.method)) return undefined;
  const contentType = req.headers.get('content-type') ?? '';
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new AppError('PAYLOAD_TOO_LARGE', 'Request body too large.');
  const text = await req.text();
  if (!text) return {};
  if (!contentType.includes('application/json')) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  }
  if (text.length > maxBytes) throw new AppError('PAYLOAD_TOO_LARGE', 'Request body too large.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Malformed JSON body.');
  }
}

function readQuery(req: Request): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const params = new URL(req.url).searchParams;
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : (all[0] ?? '');
  }
  return out;
}

function verifyCron(req: Request): void {
  const secret = getEnv().CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret ?? ''}`;
  if (!secret || header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    throw unauthenticated('Invalid cron credentials.');
  }
}

/**
 * Wraps a Route Handler with authentication, CSRF/origin checks, validation, rate limiting and consistent
 * JSON envelopes. Business authorization happens inside services.
 */
export function route<P extends Record<string, string> = Record<string, string>, B = undefined, Q = undefined>(
  config: RouteConfig<B, Q>,
  handler: Handler<P, B, Q>,
) {
  return async (req: Request, segment: { params: Promise<SegmentParams> }): Promise<Response> => {
    const requestId = req.headers.get('x-request-id') ?? randomUUID();
    try {
      checkOrigin(req);
      if (config.auth === 'cron') verifyCron(req);

      const database: Database = await getDatabase();
      let clerkUserId: string | null = null;
      let actor = null;
      if (config.auth === 'required' || config.auth === 'optional') {
        const state = await resolveAuth(req, database);
        clerkUserId = state.clerkUserId;
        actor = state.actor;
        if (config.auth === 'required') {
          if (!clerkUserId) throw unauthenticated();
          if (!actor && !config.allowWithoutProfile) {
            throw new AppError('ONBOARDING_REQUIRED', 'Complete onboarding first.');
          }
        }
      }

      const ctx = createContext(database, actor, {
        requestHash: requestFingerprint(clientIp(req), req.headers.get('user-agent')),
        locale: negotiateLocale(req.headers.get('accept-language')),
      });

      const rule = config.rateLimit ?? (MUTATING.has(req.method) ? RATE_LIMITS.write : RATE_LIMITS.default);
      const identity = actor?.userId.toHexString() ?? clerkUserId ?? ctx.requestHash ?? clientIp(req) ?? 'anonymous';
      await enforceRateLimit(database, rule, identity);

      const rawBody = await readBody(req, config.maxBodyBytes ?? 256 * 1024);
      let body = undefined as B;
      if (config.body) {
        const parsed = config.body.safeParse(rawBody ?? {});
        if (!parsed.success) throw validationError(parsed.error);
        body = parsed.data;
      }
      let query = undefined as Q;
      if (config.query) {
        const parsed = config.query.safeParse(readQuery(req));
        if (!parsed.success) throw validationError(parsed.error);
        query = parsed.data;
      }
      const params = ((await segment?.params) ?? {}) as unknown as P;

      const result = await handler({ req, params, body, query, ctx, clerkUserId, requestId });
      if (result instanceof Response) return result;
      if (result instanceof Ok) {
        if (result.status === 204) return new Response(null, { status: 204, headers: { 'X-Request-Id': requestId } });
        return json({ data: result.data, ...(result.meta ? { meta: result.meta } : {}) }, result.status, requestId);
      }
      return json({ data: result ?? null }, 200, requestId);
    } catch (error) {
      return errorResponse(error, requestId);
    }
  };
}

/** Common param schema helpers. */
export const idParam = z.object({ id: z.string() });
