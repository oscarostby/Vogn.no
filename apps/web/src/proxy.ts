import { clerkMiddleware } from '@clerk/nextjs/server';
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';
import { TEST_SESSION_COOKIE, verifyTestSession } from './server/test-session';
import { getEnv } from './server/env';

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

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

function authorizedParties(): string[] {
  const parties = new Set<string>();
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) parties.add(new URL(app).origin);
  for (const p of (process.env.CLERK_AUTHORIZED_PARTIES ?? '').split(',')) {
    const trimmed = p.trim();
    if (trimmed) parties.add(trimmed);
  }
  return [...parties];
}

const withClerk = clerkMiddleware(
  async (auth, req) => {
    if (isProtectedPage(req)) await auth.protect();
  },
  { authorizedParties: authorizedParties() },
);

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const env = getEnv();
  if (env.TEST_AUTH_ENABLED) {
    const configured = env.NEXT_PUBLIC_TEST_AUTH_ENABLED &&
      (env.TEST_AUTH_PASSWORD?.length ?? 0) >= 16 && (env.APP_SIGNING_SECRET?.length ?? 0) >= 32;
    if (isProtectedPage(req)) {
      if (!configured) return NextResponse.redirect(new URL('/setup-required', req.url));
      const identity = verifyTestSession(req.cookies.get(TEST_SESSION_COOKIE)?.value, env.APP_SIGNING_SECRET, env.TEST_AUTH_PASSWORD);
      if (!identity) {
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
