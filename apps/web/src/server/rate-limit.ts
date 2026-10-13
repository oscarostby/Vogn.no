import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Database } from './db';
import { getEnv } from './env';
import { rateLimited } from './errors';

export interface RateLimitRule {
  /** Logical bucket name, e.g. "messages.send". */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  default: { name: 'default', limit: 120, windowSeconds: 60 },
  write: { name: 'write', limit: 60, windowSeconds: 60 },
  messageSend: { name: 'messages.send', limit: 15, windowSeconds: 10 },
  reaction: { name: 'messages.react', limit: 40, windowSeconds: 10 },
  typing: { name: 'realtime.token', limit: 30, windowSeconds: 60 },
  upload: { name: 'media.upload', limit: 30, windowSeconds: 300 },
  crewCreate: { name: 'crews.create', limit: 5, windowSeconds: 3600 },
  dmCreate: { name: 'dm.create', limit: 20, windowSeconds: 3600 },
  report: { name: 'reports.create', limit: 20, windowSeconds: 3600 },
  search: { name: 'search', limit: 60, windowSeconds: 60 },
  usernameCheck: { name: 'username.check', limit: 60, windowSeconds: 60 },
  verification: { name: 'verification', limit: 10, windowSeconds: 3600 },
  vehicleLookup: { name: 'vehicle.lookup', limit: 20, windowSeconds: 3600 },
  friendRequest: { name: 'friend.request', limit: 50, windowSeconds: 3600 },
  invite: { name: 'invite.accept', limit: 30, windowSeconds: 3600 },
  export: { name: 'account.export', limit: 3, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

const redisLimiters = new Map<string, Ratelimit>();

function redisLimiter(rule: RateLimitRule): Ratelimit | null {
  const env = getEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  const key = `${rule.name}:${rule.limit}:${rule.windowSeconds}`;
  let limiter = redisLimiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
      limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
      prefix: `vogn:rl:${rule.name}`,
      analytics: false,
    });
    redisLimiters.set(key, limiter);
  }
  return limiter;
}

/**
 * Enforces a rate limit for `identity` (user id or hashed IP). Throws RATE_LIMITED when exceeded.
 * Upstash sliding window when configured; otherwise a MongoDB fixed window (TTL-cleaned).
 */
export async function enforceRateLimit(database: Database, rule: RateLimitRule, identity: string): Promise<void> {
  if (getEnv().NODE_ENV === 'test' && !process.env.ENFORCE_RATE_LIMITS) return;
  const limiter = redisLimiter(rule);
  if (limiter) {
    const result = await limiter.limit(identity);
    if (!result.success) throw rateLimited(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
    return;
  }
  const windowStart = Math.floor(Date.now() / 1000 / rule.windowSeconds) * rule.windowSeconds;
  const id = `${rule.name}:${identity}:${windowStart}`;
  const expiresAt = new Date((windowStart + rule.windowSeconds) * 1000);
  const doc = await database.cols.rateLimits.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: 'after' },
  );
  if ((doc?.count ?? 0) > rule.limit) {
    throw rateLimited(Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)));
  }
}
