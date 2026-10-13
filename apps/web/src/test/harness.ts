import { startTestDatabase, type TestDatabase } from '@vogn/database/testing';
import { setTestAuthResolver } from '@/server/auth';
import { setDatabaseForTests } from '@/server/db';
import { setPublisherForTests } from '@/server/integrations/ably';
import { setClerkInfoForTests } from '@/server/integrations/clerk';
import { setPushSenderForTests } from '@/server/integrations/push';

export interface PublishedEvent {
  channel: string;
  name: string;
  data: unknown;
  id: string;
}

export interface Harness {
  db: TestDatabase;
  events: PublishedEvent[];
  failPublishes: { value: boolean };
  stop: () => Promise<void>;
}

/**
 * Boots an isolated replica set and wires test doubles for the *external* providers only (Clerk session
 * lookup, Ably publish, Expo push). Route handlers, validation, rate limiting and all authorization logic
 * run unmodified.
 */
export async function startHarness(): Promise<Harness> {
  const db = await startTestDatabase(`vogn_web_${Math.random().toString(36).slice(2, 8)}`);
  setDatabaseForTests(db.client, db.db);
  setTestAuthResolver((req) => req.headers.get('x-test-clerk-user'));
  setClerkInfoForTests(async () => ({ emailVerified: true, phoneVerified: false, username: null }));
  const events: PublishedEvent[] = [];
  const failPublishes = { value: false };
  setPublisherForTests(async (channel, name, data, id) => {
    if (failPublishes.value) throw new Error('simulated realtime outage');
    events.push({ channel, name, data, id });
  });
  setPushSenderForTests(async () => []);
  return {
    db,
    events,
    failPublishes,
    stop: async () => {
      setTestAuthResolver(null);
      setPublisherForTests(null);
      await db.stop();
    },
  };
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

export interface CallOptions {
  method?: string;
  path?: string;
  body?: unknown;
  as?: string | null;
  params?: Record<string, string>;
  query?: Record<string, string | number>;
  headers?: Record<string, string>;
}

export interface CallResult<T = unknown> {
  status: number;
  body: { data?: T; meta?: { nextCursor?: string | null }; error?: { code: string; message: string; details?: unknown } };
  data: T;
}

export async function call<T = unknown>(handler: Handler, options: CallOptions = {}): Promise<CallResult<T>> {
  const url = new URL(`http://localhost:3000/api/v1${options.path ?? '/test'}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, String(v));
  const method = options.method ?? (options.body !== undefined ? 'POST' : 'GET');
  const headers: Record<string, string> = { origin: 'http://localhost:3000', ...options.headers };
  if (options.as) headers['x-test-clerk-user'] = options.as;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const req = new Request(url, { method, headers, body: options.body !== undefined ? JSON.stringify(options.body) : undefined });
  const res = await handler(req, { params: Promise.resolve(options.params ?? {}) });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  return { status: res.status, body, data: body.data as T };
}

let counter = 0;

/** Creates a VOGN user through the real onboarding endpoint. */
export async function createUser(username?: string): Promise<{ clerkId: string; id: string; username: string }> {
  counter += 1;
  const clerkId = `user_test_${counter}_${Math.random().toString(36).slice(2, 7)}`;
  const name = username ?? `rider_${counter}_${Math.random().toString(36).slice(2, 5)}`;
  const { POST } = await import('@/app/api/v1/me/onboarding/route');
  const res = await call<{ id: string; username: string }>(POST as Handler, {
    as: clerkId,
    body: { username: name, displayName: name, language: 'en', acceptTerms: true, interests: ['jdm'] },
  });
  if (res.status !== 201) throw new Error(`onboarding failed: ${JSON.stringify(res.body)}`);
  return { clerkId, id: res.data.id, username: res.data.username };
}
