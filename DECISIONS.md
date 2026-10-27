# Architecture Decision Record

Short, dated entries. Newest last. Each entry: context → decision → consequences.

## ADR-001 — Toolchain versions (2026-10-13)

* pnpm **10.34.x** (latest-10 line) instead of pnpm 12: mature, well-documented workspace + catalog behaviour.
  Pinned via `packageManager`.
* Turborepo 2.x, TypeScript strict everywhere (Expo SDK 57 ships TypeScript 6).
* **React 19.2.3 everywhere** (the version Expo SDK 57 pins). Next.js 16.4 accepts `^19`; keeping one React
  version avoids duplicate-React runtime errors in the monorepo (Expo docs warn about this).
* Versions are centralised in the pnpm `catalog:` in `pnpm-workspace.yaml`.

## ADR-002 — Internal packages ship TypeScript source

Packages export `./src/index.ts`. Next.js uses `transpilePackages`; Metro and Vitest read TS natively; scripts run
through `tsx`. No per-package build → faster iteration, single source of truth. Each package still runs its own
`tsc --noEmit`.

## ADR-003 — Next.js 16 `proxy.ts` + Clerk v7

Next.js 16 renamed `middleware.ts` → `proxy.ts`; Clerk v7 (`@clerk/nextjs`) documents `clerkMiddleware()` in
`proxy.ts` and `<Show when="signed-in">` instead of `SignedIn/SignedOut`. Mobile uses `@clerk/expo`
(successor of `@clerk/clerk-expo`) and sends `Authorization: Bearer <session token>`; Clerk's request
authentication accepts header tokens, so the same Route Handlers serve web and mobile.

When Clerk keys are missing the app **does not** fall back to keyless/temporary instances: protected routes
render a "configuration required" screen and the API returns `503 CONFIG_MISSING`. Public pages still render.

## ADR-004 — Services take an explicit Actor

Route Handlers are thin: authenticate → validate → call a service with `{ actor, db }`. Services contain all
authorization. This lets the authorization rules be integration-tested directly (two users, private crews,
foreign conversations) without weakening or bypassing the HTTP authentication layer.

## ADR-005 — Unified conversations for channels, DMs, group DMs and threads

Every message belongs to a `conversations` document. Crew text channels own a conversation (`kind: channel`);
access is derived from crew membership + channel permissions. DMs/group DMs use `conversationMembers`.
Threads are conversations with `parentConversationId` + `rootMessageId` and inherit access from the parent.
One message pipeline, one pagination model, one realtime channel naming scheme.

## ADR-006 — Per-conversation sequence numbers

Messages carry a strictly increasing `seq` per conversation (allocated with `$inc` inside the send
transaction). Pagination, gap detection and reconciliation use `seq`; edits/deletes are reconciled with
`updatedAt`. Trade-off: the conversation document is a write hotspot for very busy channels (documented in
`docs/scaling.md`; mitigation = sharded counters if ever needed).

## ADR-007 — Transactional outbox for Ably

Message insert + outbox insert happen in one MongoDB transaction. Publishing happens after commit and is
retried by a Vercel Cron route. Ably message `id` = outbox id, so retried publishes are deduplicated by Ably's
idempotent publishing. Ably is never the system of record.

## ADR-008 — Scoped Ably tokens per interest set

Clients request tokens for the specific conversations/crews they are viewing (≤ 50 channels). The server
verifies access for each channel and issues `subscribe`-only capability on authoritative channels,
`publish`+`subscribe` on `:typing` channels and `presence` only if the user's online-status visibility allows.
The master key never leaves the server.

## ADR-009 — Theme manifests are data, never code

Crew Studio produces a strictly validated JSON manifest (Zod, `.strict()` objects, clamped numbers, hex colours,
allowlisted fonts, https URLs on allowlisted media hosts). Renderers (web: CSS variables + React widget
registry; mobile: RN style objects) only interpret known keys. Layout lives inside the manifest so a theme
version captures tokens + layout atomically (`crewThemes` + immutable `crewThemeVersions`; a separate
`crewLayouts` collection is therefore unnecessary).

## ADR-010 — Sensitive vehicle identifiers are encrypted at the application layer

VIN / registration numbers are stored in `vehiclePrivate`, encrypted with AES-256-GCM using
`DATA_ENCRYPTION_KEY` (in addition to Atlas encryption at rest). A keyed HMAC enables duplicate detection
without decrypting. They are never returned by public endpoints.

## ADR-011 — Rate limiting

`RateLimiter` interface with an Upstash Redis implementation when `UPSTASH_REDIS_REST_URL` is configured, and a
MongoDB fixed-window implementation (TTL-indexed `rateLimits`) otherwise. Both are real, persistent limiters
that work across serverless instances.

## ADR-012 — i18n

`next-intl` (without locale-prefixed routing; locale comes from the user setting / cookie / Accept-Language).
Catalogues live in `@vogn/i18n` so mobile uses the same keys. English is the complete fallback catalogue;
other locales fall back key-by-key to English.

## ADR-013 — Test database

Integration tests use `mongodb-memory-server` as a single-node replica set (transactions supported). Tests never
touch the Atlas cluster configured in `.env.local`.

## ADR-014 — Explicit private testing without provider accounts (2026-10-13)

The owner requested a hosted private test version before provisioning Clerk and media/realtime accounts.
This adds an explicit alternative to ADR-003's default closed behavior: both `TEST_AUTH_ENABLED` and
`NEXT_PUBLIC_TEST_AUTH_ENABLED` must be enabled, with a separate long `TEST_AUTH_PASSWORD` and signing key.
Missing Clerk keys alone never enable it. A stable test login name maps to an isolated `test:<uuid>` identity
in MongoDB. Signed, expiring HttpOnly cookies authenticate normal service calls; the same permissions,
input validation, rate limits, profile checks and origin checks still apply. Optional data APIs also require
a session in this private mode. Changing the password invalidates existing cookies, and account deletion
revokes the identity. Shared test credentials are for trusted testers and must be replaced with Clerk for
public registration.

`TEST_MEDIA_ENABLED` additionally allows small images in MongoDB. Images are decoded, resized and converted
to WebP with metadata removed. Reads require authentication and the actual profile/vehicle/conversation
access, and unattached images remain owner-only. This is persistent on Vercel and uses no local upload disk.
Cloudinary remains the normal media provider. Chat uses the existing MongoDB sync API when Ably is missing.

Vercel secrets are imported from an ignored local environment export. The first database connection creates
the declared indexes. Production browser tests use an isolated replica set, not the owner's Atlas records.

## ADR-015 — Committed server-only defaults for the owner's private test deployment (2026-10-13)

The owner explicitly requested hardcoding all current test credentials and pushing the private repository
so hosting needs no environment-variable import. This supersedes ADR-014's secret-import requirement for
this throwaway test build. `server/private-test-defaults.ts` contains the existing test settings and has a
`server-only` boundary; `getEnv()` merges environment overrides over those defaults. The proxy uses the same
resolved signing key and test password as API session validation. Only the public test-mode flag is included
in Next.js client environment configuration. Defaults are excluded under `NODE_ENV=test`.

The no-environment production verification builds without `.env.local`, checks Atlas health, private page
redirects and real test login, then scans browser JavaScript bundles for all server credential values. A
future public launch must replace the test credentials and remove the committed defaults. External provider
keys that were not supplied remain unconfigured; source defaults cannot provision those provider accounts.

## ADR-016 — Personal password accounts (2026-10-26)

The owner requested registration and login for everyone without needing the shared test password. The
existing built-in auth backend now exposes separate registration and login endpoints. Registration stores
an individual salted scrypt hash; login never creates identities. Existing private identities remain
accessible with their previous credentials, and personal-password identities reject both the shared
password endpoint and legacy signed cookies.

Personal logins issue random opaque cookies backed by hashed, expiring MongoDB sessions. These do not use
the committed test signing key. Logout revokes the current session; account deletion removes all sessions.
The proxy performs a coarse token-format check, while page guards and APIs validate the session and stored
identity. Onboarding, authorization and the explicit admin identity allowlist remain authoritative.
The test-auth environment flags continue to select the built-in backend; disabling them selects Clerk.

## ADR-017 — Plate autofill and social login alongside local accounts (2026-10-26)

The owner supplied a Statens vegvesen key and explicitly requested hardcoding it. A server default now
provides that key. Authenticated, rate-limited POST lookups use the official technical single-vehicle API,
with a strict response allowlist. The editor copies available technical data into editable owner fields;
missing fields keep their current values. The first registration supplies the year if model year is
unavailable. Lookup does not mark ownership or specifications as verified, and no raw VIN or plate is
returned by the adapter. Existing encrypted identifier storage remains in use when the owner saves.

The selected Clerk application supplies Google and Apple sessions alongside existing local accounts.
Clerk middleware runs when keys exist; protected pages and APIs accept either an existing local session
or a verified Clerk session. Choosing social sign-in first clears the local session, so that the explicit
provider choice determines the next identity. Users are not automatically merged by email or username.
The development key is kept in the ignored local environment file. Google and Apple are already enabled
with Clerk's shared development credentials; production provider provisioning remains a separate task.

## ADR-018 — Self-contained deployment defaults with production overrides (2026-10-26)

The owner explicitly authorized committing all current credentials to the private repository and requested
a deployment without dotenv files. Clerk defaults are server-only, initialize the SDK before its imports,
and remain overridable through environment values. The public publishable key is provided separately to
the browser build; no server credential is exposed through Next.js `env`. Tests explicitly disable the
integration and never inherit real credentials. Vercel deployment URLs override the default hosted URL,
and authentication accepts the current request origin alongside configured authorized parties.

Shared-password login and legacy signed cookies are disabled by default behind a separate compatibility
flag. Personal-password registrations and opaque sessions continue to work. Existing Clerk development
credentials remain development credentials; production OAuth/domain provisioning cannot be manufactured
from source defaults and must be completed in Clerk before claiming production social sign-in.

## ADR-019 — Discreet gateway and member-only content (2026-10-27)

The owner approved the minimal black VOGN gateway concept: brand, short welcome, sign-in, registration
and legal links, with no public community teasers or automotive marketing. Registration remains open
to everyone. Shared UI tokens, auth screens and the default Minimal preset use graphite and off-white
instead of lime. Existing custom crew themes and user-selected colors remain personal choices.

The app layout and proxy require a session for all community pages. Previously optional content API
routes now explicitly require authentication and a completed profile even when private-test mode is
disabled. Resource-level privacy checks still apply after login. Authentication, legal pages and the
operational health endpoint remain accessible; Studio's sample preview also requires login.
