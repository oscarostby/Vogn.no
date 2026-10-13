# VOGN

Car communities, garages, crew themes, chat and events. Next.js web app in a pnpm/Turborepo workspace.

## Run locally

Node 22.12+ and the pinned pnpm version are required.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

This private testing version starts without an environment file. At the owner's explicit request, the test database access, test password and signing/encryption keys are committed in `apps/web/src/server/private-test-defaults.ts`. That module is server-only. Existing environment variables override the defaults; browser bundles receive only the public test-mode flag.

## Private testing

Test mode is enabled by the committed defaults. At `/sign-in`, use login name `oscar` and the `TEST_AUTH_PASSWORD` in the server defaults file. This login name is prepared for admin access. A new login name creates its own persistent identity, then onboarding creates the profile. Return with the same login name to use the same account. Everyone with the shared password can use any known test login name; this mode is for invited testers only.

Use two different login names in separate browser profiles to test DMs, crew memberships and privacy. MongoDB stores the data. Chat polls the durable message API without Ably. `TEST_MEDIA_ENABLED=true` enables sanitized image uploads up to 2 MB stored in MongoDB; larger images and videos require Cloudinary.

Before opening registration to real users, replace the committed test credentials, remove the defaults, disable both test auth flags and configure Clerk. Test identities remain separate from Clerk identities.

## Vercel

Follow [the deployment guide](docs/deployment.md). Set Root Directory to `apps/web` and deploy. No environment-variable import is needed for this private test build. Atlas must accept connections from the deployment.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm db:check
pnpm test:e2e
```

The application creates indexes on first database access. `pnpm db:setup` creates them explicitly. `pnpm db:seed` initializes indexes without adding fake users or elevated accounts. Integration tests use an isolated MongoDB replica set, never the Atlas database.

The browser test builds the production app and runs it on port 3100 with an isolated in-memory MongoDB replica set and dedicated test-only credentials. It exercises real HTTP sessions, onboarding, two-user chat/DMs, images and privacy, Studio publishing and main routes. On Windows it uses installed Edge; elsewhere install the Playwright Chromium browser (`pnpm --filter @vogn/web exec playwright install chromium`) or set `E2E_BROWSER_EXECUTABLE`.

Architecture and remaining roadmap: [PLAN.md](PLAN.md), [DECISIONS.md](DECISIONS.md), [PROGRESS.md](PROGRESS.md).
