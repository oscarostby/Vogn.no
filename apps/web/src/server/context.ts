import 'server-only';
import type { Collections, UserDoc } from '@vogn/database';
import type { PlatformRole, VerificationLevel } from '@vogn/types';
import type { ClientSession, Db, MongoClient, ObjectId } from 'mongodb';
import type { Database } from './db';
import { forbidden, unauthenticated } from './errors';

/** The authenticated VOGN user performing an operation. */
export interface Actor {
  userId: ObjectId;
  clerkUserId: string;
  username: string;
  displayName: string;
  platformRole: PlatformRole;
  emailVerified: boolean;
  phoneVerified: boolean;
  verificationLevels: VerificationLevel[];
  suspended: boolean;
}

export interface ServiceContext {
  client: MongoClient;
  db: Db;
  cols: Collections;
  transactions: boolean;
  actor: Actor | null;
  now: Date;
  /** Keyed hash of IP + UA for audit trails (never the raw values). */
  requestHash: string | null;
  locale: string;
}

export type AuthedContext = ServiceContext & { actor: Actor };

export function actorFromUser(user: UserDoc): Actor {
  const suspended =
    user.status === 'suspended' && (!user.suspendedUntil || user.suspendedUntil.getTime() > Date.now());
  return {
    userId: user._id,
    clerkUserId: user.clerkUserId,
    username: user.username,
    displayName: user.displayName,
    platformRole: user.platformRole,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    verificationLevels: user.verificationLevels,
    suspended,
  };
}

export function createContext(database: Database, actor: Actor | null, extra: Partial<ServiceContext> = {}): ServiceContext {
  return {
    client: database.client,
    db: database.db,
    cols: database.cols,
    transactions: database.transactions,
    actor,
    now: new Date(),
    requestHash: null,
    locale: 'en',
    ...extra,
  };
}

export function requireActor(ctx: ServiceContext): asserts ctx is AuthedContext {
  if (!ctx.actor) throw unauthenticated();
}

/** Blocks write operations for suspended accounts (reads of own data stay available). */
export function requireActive(ctx: ServiceContext): asserts ctx is AuthedContext {
  requireActor(ctx);
  if (ctx.actor.suspended) throw forbidden('Your account is suspended.');
}

export type Session = ClientSession | undefined;
