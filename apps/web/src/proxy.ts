import './server/clerk-defaults';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';
import { TEST_SESSION_COOKIE, verifyTestSession } from './server/test-session';
import { clerkAuthConfigured, getEnv } from './server/env';
import { isAccountSessionToken } from './server/account-sessions';

/** Pages that require a signed-in user. API routes authenticate inside their handlers (JSON 401s). */
const PROTECTED_PREFIXES = [
  '/home',
  '/crews',
  '/messages',
  '/garage',
  '/events/new',
  '/notifications',
  '/settings',
  '/onboarding',
  '/admin',
  '/verification',
];
const PROTECTED_CREW_SECTIONS = new Set(['settings', 'studio', 'ch']);

/**
 * Coarse redirect-to-sign-in for app pages. This is a UX convenience only: every page/layout and API
 * handler performs its own resource-level authorization check.
 */
function isProtectedPage(req: NextRequest): boolean {
  const path = req.nextUrl.pathname;
  if (getEnv().TEST_AUTH_ENABLED && ['/discover', '/events', '/u', '/v', '/c', '/invite'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return true;
  if (PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  const parts = path.split('/');
  return parts[1] === 'c' && PROTECTED_CREW_SECTIONS.has(parts[3] ?? '');
}

const clerkConfigured = clerkAuthConfigured();

function authorizedParties(req: NextRequest): string[] {
  const parties = new Set<string>();
  parties.add(new URL(req.url).origin);
  const app = getEnv().NEXT_PUBLIC_APP_URL;
  if (app) parties.add(new URL(app).origin);
  for (const p of getEnv().CLERK_AUTHORIZED_PARTIES) {
    const trimmed = p.trim();
    if (trimmed) parties.add(trimmed);
  }
  return [...parties];
}

const withClerk = clerkMiddleware(
  async (auth, req) => {
    if (!isProtectedPage(req)) return;
    const env = getEnv();
    const token = req.cookies.get(TEST_SESSION_COOKIE)?.value;
    if (env.TEST_AUTH_ENABLED && env.NEXT_PUBLIC_TEST_AUTH_ENABLED &&
      (isAccountSessionToken(token) || (env.LEGACY_TEST_AUTH_ENABLED && verifyTestSession(token, env.APP_SIGNING_SECRET, env.TEST_AUTH_PASSWORD)))) return;
    const { userId } = await auth();
    if (!userId) {
      const url = new URL('/sign-in', req.url);
      url.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
  },
  (req) => ({ authorizedParties: authorizedParties(req) }),
);

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Clerk must run on every request when configured, including requests using local accounts.
  if (clerkConfigured) return withClerk(req, event);
  const env = getEnv();
  if (env.TEST_AUTH_ENABLED) {
    const configured = env.NEXT_PUBLIC_TEST_AUTH_ENABLED &&
      (env.TEST_AUTH_PASSWORD?.length ?? 0) >= 16 && (env.APP_SIGNING_SECRET?.length ?? 0) >= 32;
    if (isProtectedPage(req)) {
      if (!configured) return NextResponse.redirect(new URL('/setup-required', req.url));
      const token = req.cookies.get(TEST_SESSION_COOKIE)?.value;
      // Opaque sessions are validated in MongoDB by page guards and API authentication.
      const identity = env.LEGACY_TEST_AUTH_ENABLED && verifyTestSession(token, env.APP_SIGNING_SECRET, env.TEST_AUTH_PASSWORD);
      if (!identity && !isAccountSessionToken(token)) {
        const url = new URL('/sign-in', req.url);
        url.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }
  if (!clerkConfigured) {
    // Fail safely: never fall back to an unauthenticated or temporary auth mode.
    if (isProtectedPage(req)) {
      const url = new URL('/setup-required', req.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  return withClerk(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
