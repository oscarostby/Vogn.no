# VOGN

Communities, crew themes, chat, garages and events. Next.js web app in a pnpm/Turborepo workspace.

The public front page is a discreet black-and-graphite account gateway: VOGN, a short greeting, sign-in
and registration. It contains no community previews or marketing sections. Community pages and content
APIs require a signed-in account with a completed profile, independently of the private-test flags.
Legal pages and authentication remain accessible before signing in. The neutral palette is shared by
the gateway, auth screens, app controls and the default VOGN Minimal crew preset; custom crew colors
and existing user preferences are retained.

## Run locally

Node 22.12+ and the pinned pnpm version are required.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

This private testing version starts without an environment file. At the owner's explicit request, the test database access, test password and signing/encryption keys are committed in `apps/web/src/server/private-test-defaults.ts`. That module is server-only. Existing environment variables override the defaults; browser bundles receive only the public test-mode flag.

## Accounts and private testing

Anyone can register at `/sign-up` with a unique login name and a personal password of at least 12 characters, then complete their profile. Return at `/sign-in` with the same login name and password (login names are case-insensitive). Signing in never creates an account. Passwords are salted and hashed with scrypt; random session tokens are stored only as hashes in MongoDB, expire after 24 hours, and are revoked on logout or account deletion. Personal accounts cannot be opened with the shared test password or a legacy signed test cookie.

The built-in account backend is enabled by the existing test-auth flags. Shared-password login and legacy signed cookies are disabled by default; `LEGACY_TEST_AUTH_ENABLED=true` is an explicit compatibility switch for isolated/private tests. Normal registration uses individual passwords. Admin access is tied to the existing explicit identity allowlist, never the name chosen during registration.

Google and Apple sign-in use the existing Clerk app alongside login-name accounts. At the owner's request, Clerk credentials are committed in the server-only `apps/web/src/server/clerk-defaults.ts`; no dotenv file or hosting environment import is required. Only the publishable key is included in the browser build. Environment values override the defaults later, and `NEXT_PUBLIC_CLERK_ENABLED=false` disables the integration. Both social connections are enabled on the selected development instance. Real Clerk production activation still requires production provider credentials and domain setup; the code accepts production keys as overrides or replacement defaults.

The production URL defaults to `https://vognno.vercel.app`; Vercel's automatic deployment URL and an explicit `NEXT_PUBLIC_APP_URL` override it. API requests and OAuth callback paths use the current origin, and Clerk validates it alongside explicitly configured authorized parties. Use `http://localhost:3000` locally; the dev command binds to that hostname so Clerk's same-origin middleware rewrites remain local.

When adding or editing a car, enter a Norwegian registration number and choose **Find vehicle**. Technical details from Statens vegvesen fill the editable form; first-registration year is used when no model year is available, and kW is converted to horsepower. Changes are saved only when the owner submits the form. This lookup does not grant ownership or verification badges. The owner's supplied Vegvesen key is hardcoded in `apps/web/src/server/vegvesen-defaults.ts`, with environment overrides still supported. Lookup requests authenticate to the server, are rate-limited, and return only the selected technical fields.

Use two different login names in separate browser profiles to test DMs, crew memberships and privacy. MongoDB stores the data. Chat polls the durable message API without Ably. `TEST_MEDIA_ENABLED=true` enables sanitized image uploads up to 2 MB stored in MongoDB; larger images and videos require Cloudinary.

Before a public production launch, replace the committed database/encryption credentials and configure Clerk's production instance and provider credentials. Shared-password test access is already disabled by default. The built-in flow uses login names and personal passwords; Clerk handles social identity and its own email verification and account recovery.

## Vercel

Follow [the deployment guide](docs/deployment.md). Set Root Directory to the repository root (`.`); the root `vercel.json` selects `apps/web` as the Next.js service. No environment-variable import is needed for this private test build. Atlas must accept connections from the deployment.

The current code has one deployable service, `web`, serving pages and `/api/*`. The directories in `packages/` are shared libraries bundled into the app, not independently running Vite services. There are no internal HTTP service calls or bindings. The root config uses Vercel services mode so additional runnable apps can be added later. Run `vercel dev` from the repository root to test the service routing locally.

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
