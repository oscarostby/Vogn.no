import 'server-only';
import { parseObjectId } from '@vogn/database';
import type { ObjectId } from 'mongodb';
import type { AuthedContext, ServiceContext } from '../context';
import { notFound, unauthenticated } from '../errors';

/** Parses an id path parameter; malformed ids are reported as NOT_FOUND (no format oracle). */
export function oid(value: string | undefined, what = 'Resource'): ObjectId {
  const id = parseObjectId(value);
  if (!id) throw notFound(what);
  return id;
}

export function authed(ctx: ServiceContext): AuthedContext {
  if (!ctx.actor) throw unauthenticated();
  return ctx as AuthedContext;
}
