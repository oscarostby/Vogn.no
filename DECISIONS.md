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
