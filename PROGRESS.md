# VOGN — Progress (resumable checkpoint)

Read `PLAN.md` (architecture) and `DECISIONS.md` (rationale) first. Last updated: 2026-10-13.

## Phase status

| Phase | State |
| --- | --- |
| 1 Foundation | ✅ monorepo, packages, Next app, Clerk proxy, env validation, errors, shell, landing — 🟡 Expo app not scaffolded yet |
| 2 Profiles & garages | ✅ API + tests; ✅ UI: onboarding, profile, garage list, vehicle editor (specs/mods/gallery/identifiers/visibility), build page, timeline, comments — ⏳ settings pages |
| 3 Crew core | ✅ services + routes + tests (create, discover, join, invites, applications, roles, channels, moderation) — ⏳ UI (crews list, wizard, crew layout, settings) |
| 4 Messaging | ✅ services + routes + tests (seq, idempotency, outbox, sync, reactions, pins, threads, read, DMs), ✅ Ably client provider — ⏳ chat UI |
| 5 Crew Studio | ✅ theme-engine (schema, 21 widgets, 5 presets, resolver, CSS/native), ✅ renderer (ThemeScope, CrewHeader, PageRenderer, widgets) — ⏳ theme service/routes, widget-data endpoint, Studio editor UI, playground |
| 6 Verification | ⏳ (types, validation, R2 adapter, honest level labels exist; services/routes/UI not built; SVV adapter not written) |
| 7 Events & discovery | ✅ events service/routes (RSVP, waitlist, ICS, reminders fn), discover/search services/routes — ⏳ UI, reports service, cron routes |
| 8 Mobile | ⏳ not started (brand icons generated in `apps/mobile/assets/images`) |
| 9–10 | ⏳ |

## Next exact steps

1. Web UI: `/crews`, `/crews/new` (wizard), `/c/[slug]` layout (themed, channel sidebar), `/c/[slug]/ch/[channelId]` chat (use `useConversationEvents`, `useTyping`, sync on reconnect), `/messages`, `/messages/[id]`, `/discover`, `/events`, `/events/[id]`, `/notifications`, `/settings/*`, `/invite/[code]`, `/legal/*`.
2. Server: `services/themes.ts` (draft/publish/versions/restore/import/export/preset), routes under `crews/id/[crewId]/theme/*`, `crews/id/[crewId]/widgets`, polls; `services/reports.ts` + `/api/v1/reports`; `/api/cron/{outbox,reminders,cleanup}` (route auth `'cron'`) + `vercel.json` crons.
3. Crew Studio editor UI + `/studio/playground` (public, local-only).
4. Verification services (photo challenge, R2 evidence, review queue) + SVV adapter (`https://akfell-datautlevering.atlas.vegvesen.no/enkeltoppslag/kjoretoydata?kjennemerke=`, header `SVV-Authorization: Apikey <key>` — confirm against official docs when a key is obtained).
5. Admin dashboard, marketplace, LiveKit voice token, Expo app (`create-expo-app` default template ref: SDK 57, RN 0.86.3, React 19.2.3, `@clerk/expo`).
6. Docs folder (`docs/*.md`), README, Playwright E2E.

## Verified so far

- `tsc --noEmit` clean for all packages and `apps/web`.
- Vitest: utils 11, permissions 11, theme-engine 21, i18n 4, database 5, web integration 27 (accounts/garage 13, crews/messaging 14) — all passing (in-memory MongoDB replica set).
- Dev server renders the landing page; theme presets visually distinct (checked in browser).
- NOT verified: anything requiring Clerk keys (sign-in, signed-in UI), Atlas connectivity with the placeholder credentials, Cloudinary/R2/Ably/LiveKit against real accounts.

## Setup notes

- `apps/web/.env.local` (gitignored) holds the owner-supplied placeholder Mongo credentials + generated local secrets. Clerk keys are empty → app shows "configuration required" for protected pages.
- Run: `pnpm install`, `pnpm dev`, `pnpm test`. Commits authored with the repo's existing identity (no git config was changed).
