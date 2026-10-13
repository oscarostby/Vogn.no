import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';

/** Pages that require a signed-in user. API routes authenticate inside their handlers (JSON 401s). */
const isProtectedPage = createRouteMatcher([
  '/home(.*)',
  '/crews(.*)',
  '/messages(.*)',
  '/garage(.*)',
  '/events/new(.*)',
  '/notifications(.*)',
  '/settings(.*)',
  '/onboarding(.*)',
  '/admin(.*)',
  '/verification(.*)',
  '/c/:slug/settings(.*)',
  '/c/:slug/studio(.*)',
  '/c/:slug/ch(.*)',
]);

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
