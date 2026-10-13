import 'server-only';
import * as Ably from 'ably';
import { getEnv } from '../env';

let rest: Ably.Rest | null = null;
let restKey: string | null = null;

export function ablyConfigured(): boolean {
  return Boolean(getEnv().ABLY_API_KEY);
}

function client(): Ably.Rest {
  const key = getEnv().ABLY_API_KEY;
  if (!key) throw new Error('Ably is not configured');
  if (!rest || restKey !== key) {
    rest = new Ably.Rest({ key, idempotentRestPublishing: true });
    restKey = key;
  }
  return rest;
}

export type PublishFn = (channel: string, name: string, data: unknown, id: string) => Promise<void>;

let publishOverride: PublishFn | null = null;

/** Tests capture published events instead of calling Ably. */
export function setPublisherForTests(fn: PublishFn | null): void {
  publishOverride = fn;
}

export function realtimeAvailable(): boolean {
  return Boolean(publishOverride) || ablyConfigured();
}

/** Publishes an authoritative event. `id` makes retries idempotent on Ably's side. */
export async function publishEvent(channel: string, name: string, data: unknown, id: string): Promise<void> {
  if (publishOverride) return publishOverride(channel, name, data, id);
  await client().channels.get(channel).publish({ id, name, data });
}

export type Capability = Record<string, ('subscribe' | 'publish' | 'presence' | 'history')[]>;

/** Signed TokenRequest for the client; the API key itself never leaves the server. */
export async function createTokenRequest(clientId: string, capability: Capability, ttlMs = 60 * 60 * 1000) {
  return client().auth.createTokenRequest({ clientId, capability, ttl: ttlMs });
}
