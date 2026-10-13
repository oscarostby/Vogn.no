# VOGN — Technical Plan

> Your crew. Your space.

VOGN is a global social platform for car enthusiasts: Discord-style communities ("Crews") with deep visual
customization (Crew Studio), privacy-first profiles, digital garages, realtime chat, events and optional,
honestly-labelled verification.

This document is the architectural source of truth. Progress lives in `PROGRESS.md`, rationale in
`DECISIONS.md`.

---

## 1. Architecture overview

```
┌──────────────┐      HTTPS (cookie session)      ┌──────────────────────────────────────────┐
│  Web (Next)  │ ───────────────────────────────▶ │ Next.js Route Handlers  (Vercel, Node.js) │
└──────────────┘                                  │  /api/v1/*                                │
┌──────────────┐  HTTPS (Clerk Bearer token)      │  ├─ auth: Clerk (cookie or Bearer)        │
│ Mobile (Expo)│ ───────────────────────────────▶ │  ├─ validation: Zod (@vogn/validation)    │
└──────────────┘                                  │  ├─ authz: @vogn/permissions + services   │
      ▲  ▲                                        │  ├─ rate limits (Upstash or Mongo)        │
      │  │  scoped token (subscribe-only on       │  └─ data: @vogn/database (MongoDB driver) │
      │  │  authoritative channels)               └───────┬───────────────┬─────────┬─────────┘
      │  └───────────── Ably Pub/Sub ◀── publish ─────────┘ (outbox)      │         │
      │                                                   MongoDB Atlas ◀─┘   Cloudinary / R2
      └── signed direct uploads ─────────────────────────────────────────────────────▶
```

* **No long-running servers.** All server code runs as Next.js Route Handlers / Server Components on Vercel
  (Node.js runtime for anything touching MongoDB). Scheduled maintenance runs through Vercel Cron hitting
  authenticated `/api/cron/*` routes.
* **MongoDB Atlas is the source of truth** for every domain object, including chat history.
* **Ably** delivers events. Authoritative events (`message.created` etc.) are only published by the server
  through a transactional outbox. Clients receive capability-scoped tokens: subscribe-only on authoritative
  channels, publish only on ephemeral `:typing` channels, presence only where the user allows it.
* **Clerk** owns identity (Apple, Google, email/password, verification, reset, MFA, passkeys). VOGN keeps its
  own profile records in MongoDB linked by `clerkUserId`.
* **Cloudinary** stores public media; **Cloudflare R2** (S3 API, presigned URLs) stores private verification
  evidence. MongoDB stores only metadata/references.

## 2. Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js App Router site, app UI, `/api/v1` serverless API, admin dashboard |
| `apps/mobile` | Expo Router app for iOS/Android |
| `packages/types` | Domain + API DTO types shared by every runtime |
| `packages/validation` | Zod schemas for every API input (shared by server, web forms and mobile) |
| `packages/api-client` | Typed fetch client used by web and mobile |
| `packages/database` | MongoDB connection, typed collections, indexes, pagination, transactions |
| `packages/permissions` | Crew permission engine (roles, overwrites, hierarchy) – pure functions |
| `packages/theme-engine` | Versioned theme manifest schema, presets, resolver, contrast guard, widget registry metadata |
| `packages/ui-tokens` | VOGN global design tokens (dark/light), spacing, radii, motion |
| `packages/utils` | Runtime-agnostic helpers (ids, cursors, slugs, dates, units, result types) |
| `packages/i18n` | Translation catalogues (en, nb, sv, da, de, ja) + locale helpers |
| `scripts` | DB index setup, fixtures, migrations, maintenance |
| `docs` | Architecture, API, security, operations, deployment, privacy, E2EE roadmap |

Internal packages ship TypeScript source (Turborepo "just-in-time" packages): Next.js transpiles them via
`transpilePackages`, Metro/Vitest consume TS directly. No build step for packages → fewer moving parts.

## 3. Server layering (apps/web/src/server)

```
route.ts (HTTP)  →  http/handler.ts  (auth, origin check, Zod, rate-limit, error mapping, JSON envelope)
                 →  services/*.ts    (business rules + authorization; take an explicit Actor)
                 →  @vogn/database   (typed collections, indexes, transactions)
                 →  integrations/*   (ably, cloudinary, r2, vegvesen, livekit, expo-push, email)
```

* Every service function receives `ctx: { actor, db }`. Authorization is decided in services, never in UI.
* Knowing an ID never grants access: every read checks membership/visibility.
* Services are unit/integration tested against an in-memory MongoDB replica set (transactions enabled).

### Response envelope

```jsonc
// success
{ "data": { ... }, "meta": { "nextCursor": "..." } }
// error
{ "error": { "code": "FORBIDDEN", "message": "You cannot view this channel.", "details": {...} } }
```

Codes: `UNAUTHENTICATED`, `ONBOARDING_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`,
`RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `CONFIG_MISSING`, `PROVIDER_ERROR`, `INTERNAL`.

## 4. Data model (MongoDB)

All documents: `_id: ObjectId`, `createdAt`, `updatedAt`. API exposes string `id`.
Unbounded relationships live in their own collections (members, messages, RSVPs, reactions…).

| Collection | Key fields | Indexes |
| --- | --- | --- |
| `users` | clerkUserId, username, usernameLower, displayName, avatar, banner, bio, country, language, pronouns, website, socialLinks[≤8], favoriteBrands[≤20], interests[≤20], featuredVehicleId, accentColor, platformRole, status | `clerkUserId` unique, `usernameLower` unique, text(displayName, username) |
| `usernameRedirects` | usernameLower → userId, expiresAt | `usernameLower` unique, TTL `expiresAt` |
| `userSettings` | visibility (profile/online/garage/activity), dmPrivacy, badge visibility, notification prefs, quiet hours, locale, units, theme | `userId` unique |
| `userConnections` | fromUserId, toUserId, kind (`friend`/`follow`), status | unique (from,to,kind); (to,kind,status) |
| `userBlocks` | blockerId, blockedId | unique (blocker, blocked); (blocked) |
| `vehicles` | ownerId, make/model/generation/year/trim, powertrain, claimed specs, officialSpecs (provider snapshot), mods (categories + items, bounded), visibility, visibleCrewIds[≤20], verification summary | (ownerId, createdAt), (make, model), (visibility, updatedAt) |
| `vehiclePrivate` | vehicleId, AES-256-GCM encrypted VIN / registration, HMAC lookup hash | `vehicleId` unique, `registrationHash` |
| `vehicleBuildUpdates` | vehicleId, kind, title, body, media[≤10], cost (owner-only unless shared), occurredAt | (vehicleId, occurredAt) |
| `vehicleLikes`, `vehicleComments` | vehicleId, userId / body | unique (vehicleId,userId); (vehicleId, createdAt) |
| `crews` | slug, name, description, icon, banner, region, country, language, visibility, category, tags, ownerId, memberCount, requirements, applicationForm | `slug` unique, (visibility, memberCount), text(name, description, tags) |
| `crewRoles` | crewId, name, color, badge, position, permissions[], managed | (crewId, position) |
| `crewMembers` | crewId, userId, roleIds[≤25], nickname, accent, status, timeoutUntil | unique (crewId,userId); (userId, status) |
| `crewChannels` | crewId, conversationId, name, type, parentId, position, topic, overwrites[≤50], locked, slowmode | (crewId, position) |
| `crewInvitations` | crewId, code, createdBy, maxUses, uses, expiresAt | `code` unique, TTL |
| `crewApplications` | crewId, userId, answers, sharedVerification, status | (crewId,status,createdAt); unique pending (crewId,userId) |
| `crewThemes` | crewId, draft manifest, published manifest, publishedVersion | `crewId` unique |
| `crewThemeVersions` | crewId, version, manifest, publishedBy | unique (crewId, version) |
| `themeMarketplace`, `themeRatings` | listing + sanitized manifest / rating | `slug` unique; unique (themeId,userId) |
| `conversations` | kind (`channel`/`dm`/`group_dm`/`thread`), crewId, channelId, dmKey, lastMessageAt, messageSeq | `dmKey` unique partial, (channelId) |
| `conversationMembers` | conversationId, userId, muted, hidden | unique (conversationId,userId); (userId, lastMessageAt) |
| `messages` | conversationId, seq, senderId, type, content, mentions, attachments[≤10], replyToId, threadId, reactions summary, pinned, editedAt, deletedAt, moderation, idempotencyKey | unique (conversationId, seq); unique partial (senderId, idempotencyKey); (conversationId, updatedAt); (conversationId, pinned); text(content) |
| `messageReactions` | messageId, userId, emoji | unique (messageId,userId,emoji) |
| `messageOutbox` | channel, name, payload, status, attempts, nextAttemptAt | (status, nextAttemptAt); TTL on sent |
| `messageReadStates` | userId, conversationId, lastReadSeq, mentionCount | unique (userId, conversationId) |
| `events`, `eventRSVPs` | crewId, organizer, start/end UTC + tz, location (protected), visibility, limits / status | (crewId, startsAt), (visibility, startsAt); unique (eventId,userId) |
| `notifications` | userId, type, actorId, data, readAt | (userId, createdAt), TTL 180d |
| `pushTokens` | userId, token, platform | `token` unique |
| `verificationRequests` | userId, vehicleId, kind, status, challenge, evidence keys (R2), retention | (userId, createdAt), (status, submittedAt), `challenge.code` unique |
| `verificationResults` | userId, vehicleId, level, provider, method, decidedAt, revokedAt | (userId, level), (vehicleId) |
| `reports`, `moderationActions`, `appeals`, `auditLogs` | moderation + audit trail | (status, createdAt), (crewId, createdAt), (actorId, createdAt) |
| `mediaAssets` | ownerId, provider, publicId/key, url, kind, mime, bytes, purpose, status | (ownerId, purpose), `publicId` unique |
| `rateLimits` | key, count, expiresAt | TTL `expiresAt` |

Full index list: `docs/database.md` + `packages/database/src/indexes.ts` (applied by `pnpm db:setup`).

## 5. Messaging pipeline

1. Client generates `idempotencyKey` (UUID) and renders the message optimistically (`pending`).
2. `POST /api/v1/conversations/:id/messages` → auth → membership + `SEND_MESSAGES` (+ `UPLOAD_ATTACHMENTS`,
   lock/timeout/slowmode/blocks) → Zod → rate limit.
3. Transaction: `$inc conversations.messageSeq` → insert message (`seq`) → insert outbox row.
   Duplicate `idempotencyKey` returns the original message (no double send).
4. After commit: publish outbox row to Ably (message id = outbox id ⇒ Ably idempotent publish); mark sent.
   Failures stay `pending` and are retried by `/api/cron/outbox`.
5. Clients subscribed to `conv:{id}` merge events by `id`, replace optimistic copies by `idempotencyKey`.
6. On (re)connect or detected `seq` gap, clients call `GET /messages/sync?afterSeq=` and
   `?updatedSince=` to reconcile from MongoDB.
7. History: `GET /messages?before=<seq>&limit=50` (cursor pagination on `seq`).

Ephemeral: `conv:{id}:typing` (client publish/subscribe), presence on `crew:{id}:presence` (only if the user's
online-status visibility allows).

## 6. Crew Studio / Theme engine

* `ThemeManifest` v1 (Zod, strict): tokens (colors light/dark, typography from an allowlisted font set,
  radius, density, borders, shadows), surfaces (solid/gradient/image/video background + safe patterns),
  component variants (buttons, cards, channel list, message style, header style), layout per breakpoint
  (desktop/mobile navigation placement, sidebar position, member list), pages → sections → widgets (12-column
  grid spans per breakpoint), navigation items, channel overrides, role badges, animation presets.
* No HTML/JS/CSS strings are accepted. Colors are validated hex, URLs must be https on allowlisted media hosts,
  numbers are clamped. The renderer maps validated values to CSS variables / RN styles.
* Contrast guard (WCAG 2.x) auto-corrects unreadable text colours; reduced motion disables effects; any
  manifest that fails validation falls back to the VOGN default theme.
* Draft → Publish (immutable version) → Restore (copy version to draft) → Import/Export JSON manifests.
* Presets: Tokyo Midnight, Euro Atelier, American Iron, Offroad Expedition, VOGN Minimal (distinct layouts,
  type, surfaces and widget arrangements — not just accent swaps).
* Widgets: welcome, announcements, member count, featured member, featured car, vehicle gallery, current
  builds, upcoming meets, event calendar, rich text (safe markdown), image gallery, links, poll, rules,
  leaderboard, popular discussions. Each widget fetches through permission-checked APIs.

## 7. Security model (summary — details in `docs/security.md`)

* AuthN: Clerk (cookie for web, Bearer for mobile, `authorizedParties` set). AuthZ: services + permission engine.
* CSRF: mutations require JSON content type + same-origin `Origin` for cookie-authenticated requests.
* Secure headers (CSP, HSTS, frame-ancestors none, referrer policy, permissions policy) in `next.config.ts`.
* Rate limits per user/IP/route class; upload limits & MIME allowlists; signed Cloudinary uploads verified
  server-side; R2 presigned URLs (short TTL) for private evidence.
* Sensitive data isolation: VIN/registration encrypted with AES-256-GCM (`DATA_ENCRYPTION_KEY`),
  verification evidence in private storage with retention deletion; moderators see outcomes only.
* Audit log for security-sensitive and administrative actions. Webhooks (Clerk via Svix) signature-verified.
* No E2EE claims — see `docs/e2ee-roadmap.md`.

## 8. Phases

| # | Phase | Deliverable |
| --- | --- | --- |
| 1 | Foundation | Monorepo, Next app, Expo app, shared packages, tokens, shell, Clerk, MongoDB, env validation, errors, docs |
| 2 | Profiles & Garages | Onboarding, profiles + privacy, uploads, garage CRUD, vehicle pages, timelines, galleries |
| 3 | Crew core | Create/discover/join/invite, channels, roles & permissions, private access, settings |
| 4 | Messaging | Persistence, Ably, channels, DMs, group DMs, pagination, reactions, replies, edit/delete, typing, presence, read state, reconciliation |
| 5 | Crew Studio | Theme schema, presets, editor, layout builder, widgets, preview, draft/publish/versioning, import/export, mobile rendering |
| 6 | Verification & applications | Provider architecture, Norway SVV adapter, photo challenge, R2 evidence, review queue, crew rules, application forms, consent |
| 7 | Events & discovery | Events/RSVP, discovery (crews, builds), search, connections, reports, notifications |
| 8 | Mobile | Auth, profiles, garages, crews, chat, notifications, events, themed crew rendering |
| 9 | Advanced | LiveKit voice, theme marketplace, more widgets, moderation, extra providers, i18n, perf |
| 10 | Production readiness | Reviews (security/perf/a11y), index verification, tests, deployment config, legal pages, monitoring |

## 9. Testing strategy

* `tsc --noEmit` (strict) + ESLint in every workspace (`pnpm typecheck`, `pnpm lint`).
* Vitest unit tests for pure packages (permissions, theme-engine, validation, utils).
* Vitest integration tests for services against `mongodb-memory-server` replica set (transactions on),
  including cross-user / cross-crew authorization failure tests.
* Playwright: public-surface E2E always; authenticated scenarios run when Clerk test credentials are present
  (`@clerk/testing`), otherwise skipped with an explicit reason.
