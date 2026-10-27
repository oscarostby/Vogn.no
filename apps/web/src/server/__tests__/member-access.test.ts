import { afterAll, beforeAll, expect, it } from 'vitest';
import * as builds from '@/app/api/v1/discover/builds/route';
import * as crews from '@/app/api/v1/discover/crews/route';
import * as profile from '@/app/api/v1/users/[username]/route';
import * as garage from '@/app/api/v1/users/[username]/garage/route';
import * as vehicle from '@/app/api/v1/vehicles/[id]/route';
import * as updates from '@/app/api/v1/vehicles/[id]/updates/route';
import * as comments from '@/app/api/v1/vehicles/[id]/comments/route';
import * as events from '@/app/api/v1/events/route';
import * as event from '@/app/api/v1/events/[id]/route';
import * as calendar from '@/app/api/v1/events/[id]/ics/route';
import * as invite from '@/app/api/v1/invites/[code]/route';
import * as crew from '@/app/api/v1/crews/[slug]/route';
import * as crewDetail from '@/app/api/v1/crews/id/[crewId]/route';
import * as theme from '@/app/api/v1/crews/id/[crewId]/theme/route';
import * as search from '@/app/api/v1/search/route';
import { getEnv, overrideEnvForTests, type Env } from '@/server/env';
import { call, startHarness, type Harness } from '@/test/harness';

let h: Harness;
let previous: Env;
beforeAll(async () => {
  previous = { ...getEnv() };
  h = await startHarness();
  overrideEnvForTests({ TEST_AUTH_ENABLED: false, NEXT_PUBLIC_TEST_AUTH_ENABLED: false });
});
afterAll(async () => {
  overrideEnvForTests(previous);
  await h?.stop();
});

it('keeps all community content behind authentication outside private test mode', async () => {
  for (const [name, endpoint] of Object.entries({ builds, crews, profile, garage, vehicle, updates, comments, events, event, calendar, invite, crew, crewDetail, theme, search })) {
    const result = await call(endpoint.GET);
    expect(result.status, name).toBe(401);
    expect(result.body.error?.code, name).toBe('UNAUTHENTICATED');
  }
});
