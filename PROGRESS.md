# VOGN — Progress

Resumable checkpoint. Read `PLAN.md` (architecture) and `DECISIONS.md` (rationale) first.

## Status

| Phase | State |
| --- | --- |
| 1 Foundation | 🟡 in progress — shared packages done, web/mobile apps next |
| 2–10 | ⏳ not started |

## Done

- Root workspace: pnpm 10 workspaces + catalog, Turborepo, strict TS base config, ESLint flat config, Prettier.
- `@vogn/utils` — colour/contrast, safe markdown AST parser (no HTML), slugs, units, dates/quiet hours, countries. Tests ✅
- `@vogn/ui-tokens` — global dark/light tokens, spacing, radii, motion.
- `@vogn/types` — domain + API DTO types (users, vehicles, crews, chat, verification, events, notifications, moderation).
- `@vogn/permissions` — crew permission engine (roles, channel overwrites, hierarchy, timeouts) + platform roles. Tests ✅
- `@vogn/validation` — Zod 4 schemas for every API input; messages are i18n keys.
- `@vogn/theme-engine` — strict ThemeManifest v1, 21 widget types, 5 presets, resolver + WCAG contrast guard, CSS/RN projections, marketplace sanitising. Tests ✅
- `@vogn/i18n` — en (complete), nb/sv/da/de/ja (partial, key-by-key fallback). Tests ✅
- `@vogn/database` — typed collections, all indexes, cursors, transactions, in-memory replica set for tests. Tests ✅
- `@vogn/api-client` — typed client covering the full planned API + signed upload helper.

## Next step

Scaffold `apps/web` (Next.js 16, Tailwind 4, Clerk v7 `proxy.ts`, next-intl, TanStack Query) and implement the
server layer (`src/server/http`, env validation, auth helpers) + app shell.

## Test log

- `packages/*`: `tsc --noEmit` clean; vitest: utils 11, permissions 11, theme-engine 21, i18n 4, database 5 — all passing.
