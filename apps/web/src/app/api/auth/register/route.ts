import { accountAuthRoute } from '@/server/account-auth-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = accountAuthRoute(true);
