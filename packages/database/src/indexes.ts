import type { CreateIndexesOptions, Db, IndexSpecification } from 'mongodb';
import { COLLECTION_NAMES, type CollectionName } from './collections';

export interface IndexDefinition {
  key: IndexSpecification & Record<string, 1 | -1 | 'text'>;
  options?: CreateIndexesOptions;
  /** Query pattern this index serves (documentation; rendered into docs/database.md). */
  purpose: string;
}

/**
 * Every index VOGN relies on. `pnpm db:setup` applies them idempotently; `pnpm db:check` verifies them.
 * Names are explicit so they can be compared and dropped safely in migrations.
 */
export const INDEXES: Record<CollectionName, IndexDefinition[]> = {
  users: [
    { key: { clerkUserId: 1 }, options: { name: 'clerkUserId_unique', unique: true }, purpose: 'Resolve session → profile' },
    { key: { usernameLower: 1 }, options: { name: 'username_unique', unique: true }, purpose: 'Unique usernames, profile lookups' },
    { key: { status: 1, createdAt: -1 }, options: { name: 'status_created' }, purpose: 'Admin lists, stats' },
    { key: { lastActiveAt: -1 }, options: { name: 'lastActive' }, purpose: 'Active-user metrics' },
    {
      key: { displayName: 'text', username: 'text' },
      options: { name: 'user_text', weights: { username: 3, displayName: 2 }, default_language: 'none' },
      purpose: 'Global search (users)',
    },
  ],
  usernameRedirects: [
    { key: { usernameLower: 1 }, options: { name: 'redirect_unique', unique: true }, purpose: 'Renamed profile links' },
    { key: { expiresAt: 1 }, options: { name: 'redirect_ttl', expireAfterSeconds: 0 }, purpose: 'Expire old handles' },
  ],
  userSettings: [{ key: { userId: 1 }, options: { name: 'userId_unique', unique: true }, purpose: 'Settings by user' }],
  userConnections: [
    {
      key: { fromUserId: 1, toUserId: 1, kind: 1 },
      options: { name: 'edge_unique', unique: true },
      purpose: 'One edge per direction/kind',
    },
    { key: { toUserId: 1, kind: 1, status: 1, createdAt: -1 }, options: { name: 'incoming' }, purpose: 'Incoming requests/followers' },
    { key: { fromUserId: 1, kind: 1, status: 1, createdAt: -1 }, options: { name: 'outgoing' }, purpose: 'Outgoing/following' },
  ],
  userBlocks: [
    { key: { blockerId: 1, blockedId: 1 }, options: { name: 'block_unique', unique: true }, purpose: 'Block checks' },
    { key: { blockedId: 1 }, options: { name: 'blocked' }, purpose: 'Reverse block checks' },
  ],
  pushTokens: [
    { key: { token: 1 }, options: { name: 'token_unique', unique: true }, purpose: 'Dedupe device tokens' },
    { key: { userId: 1 }, options: { name: 'user' }, purpose: 'Send push to user' },
  ],
  vehicles: [
    { key: { ownerId: 1, deletedAt: 1, createdAt: -1 }, options: { name: 'garage' }, purpose: 'User garage listing' },
    { key: { visibility: 1, deletedAt: 1, updatedAt: -1 }, options: { name: 'discover' }, purpose: 'Discover builds feed' },
    { key: { makeLower: 1, modelLower: 1, updatedAt: -1 }, options: { name: 'make_model' }, purpose: 'Filter by make/model' },
    { key: { visibleCrewIds: 1, updatedAt: -1 }, options: { name: 'crew_shared' }, purpose: 'Crew vehicle galleries' },
    {
      key: { make: 'text', model: 'text', nickname: 'text', generation: 'text' },
      options: { name: 'vehicle_text', default_language: 'none' },
      purpose: 'Global search (vehicles)',
    },
  ],
  vehiclePrivate: [
    { key: { vehicleId: 1 }, options: { name: 'vehicle_unique', unique: true }, purpose: 'Private identifiers by vehicle' },
    { key: { registrationHash: 1 }, options: { name: 'reg_hash', sparse: true }, purpose: 'Duplicate detection' },
    { key: { ownerId: 1 }, options: { name: 'owner' }, purpose: 'Account deletion/export' },
  ],
  vehicleBuildUpdates: [
    { key: { vehicleId: 1, occurredAt: -1 }, options: { name: 'timeline' }, purpose: 'Build timeline' },
    { key: { authorId: 1, createdAt: -1 }, options: { name: 'author' }, purpose: 'Export/deletion' },
  ],
  vehicleLikes: [
    { key: { vehicleId: 1, userId: 1 }, options: { name: 'like_unique', unique: true }, purpose: 'One like per user' },
    { key: { userId: 1 }, options: { name: 'user' }, purpose: 'Export/deletion' },
  ],
  vehicleComments: [
    { key: { vehicleId: 1, createdAt: -1 }, options: { name: 'thread' }, purpose: 'Comments by vehicle' },
    { key: { authorId: 1 }, options: { name: 'author' }, purpose: 'Export/deletion' },
  ],
  crews: [
    { key: { slug: 1 }, options: { name: 'slug_unique', unique: true }, purpose: 'Crew URLs' },
    { key: { visibility: 1, deletedAt: 1, activityScore: -1 }, options: { name: 'trending' }, purpose: 'Discover: trending' },
    { key: { visibility: 1, deletedAt: 1, memberCount: -1 }, options: { name: 'by_size' }, purpose: 'Discover: largest' },
    { key: { visibility: 1, deletedAt: 1, createdAt: -1 }, options: { name: 'newest' }, purpose: 'Discover: new' },
    { key: { country: 1, category: 1, memberCount: -1 }, options: { name: 'country_category' }, purpose: 'Discover filters' },
    { key: { ownerId: 1 }, options: { name: 'owner' }, purpose: 'Owned crews, deletion' },
    {
      key: { name: 'text', description: 'text', tags: 'text', region: 'text' },
      options: { name: 'crew_text', weights: { name: 5, tags: 3, region: 2, description: 1 }, default_language: 'none' },
      purpose: 'Crew search',
    },
  ],
  crewSlugRedirects: [
    { key: { slug: 1 }, options: { name: 'slug_unique', unique: true }, purpose: 'Renamed crew links' },
    { key: { expiresAt: 1 }, options: { name: 'ttl', expireAfterSeconds: 0 }, purpose: 'Expire old slugs' },
  ],
  crewMembers: [
    { key: { crewId: 1, userId: 1 }, options: { name: 'membership_unique', unique: true }, purpose: 'Membership checks' },
    { key: { userId: 1, status: 1, joinedAt: -1 }, options: { name: 'my_crews' }, purpose: 'Crews of a user' },
    { key: { crewId: 1, status: 1, joinedAt: -1 }, options: { name: 'roster' }, purpose: 'Member lists' },
    { key: { crewId: 1, roleIds: 1 }, options: { name: 'role_members' }, purpose: 'Members by role' },
  ],
  crewRoles: [{ key: { crewId: 1, position: -1 }, options: { name: 'crew_roles' }, purpose: 'Roles by crew' }],
  crewChannels: [
    { key: { crewId: 1, deletedAt: 1, position: 1 }, options: { name: 'crew_channels' }, purpose: 'Channel list' },
    { key: { conversationId: 1 }, options: { name: 'conversation', sparse: true }, purpose: 'Conversation → channel' },
  ],
  crewInvitations: [
    { key: { code: 1 }, options: { name: 'code_unique', unique: true }, purpose: 'Invite lookups' },
    { key: { crewId: 1, createdAt: -1 }, options: { name: 'crew' }, purpose: 'Invite management' },
    { key: { expiresAt: 1 }, options: { name: 'ttl', expireAfterSeconds: 7 * 24 * 3600 }, purpose: 'Purge a week after expiry' },
  ],
  crewApplications: [
    { key: { crewId: 1, status: 1, createdAt: -1 }, options: { name: 'queue' }, purpose: 'Review queue' },
    {
      key: { crewId: 1, userId: 1 },
      options: { name: 'pending_unique', unique: true, partialFilterExpression: { status: 'pending' } },
      purpose: 'One pending application per user/crew',
    },
    { key: { userId: 1, createdAt: -1 }, options: { name: 'mine' }, purpose: 'My applications, export' },
  ],
  crewThemes: [{ key: { crewId: 1 }, options: { name: 'crew_unique', unique: true }, purpose: 'Theme by crew' }],
  crewThemeVersions: [
    { key: { crewId: 1, version: -1 }, options: { name: 'version_unique', unique: true }, purpose: 'Version history' },
  ],
  themeMarketplace: [
    { key: { slug: 1 }, options: { name: 'slug_unique', unique: true }, purpose: 'Listing URLs' },
    { key: { status: 1, installs: -1 }, options: { name: 'popular' }, purpose: 'Browse popular' },
    { key: { status: 1, createdAt: -1 }, options: { name: 'newest' }, purpose: 'Browse new / review queue' },
    { key: { authorId: 1 }, options: { name: 'author' }, purpose: 'My themes' },
  ],
  themeRatings: [{ key: { themeId: 1, userId: 1 }, options: { name: 'rating_unique', unique: true }, purpose: 'One rating per user' }],
  pollVotes: [
    { key: { crewId: 1, pollKey: 1, userId: 1 }, options: { name: 'vote_unique', unique: true }, purpose: 'One vote per poll' },
  ],
  conversations: [
    {
      key: { dmKey: 1 },
      options: { name: 'dm_unique', unique: true, partialFilterExpression: { dmKey: { $type: 'string' } } },
      purpose: 'One 1:1 DM per pair',
    },
    { key: { channelId: 1 }, options: { name: 'channel', sparse: true }, purpose: 'Channel conversation' },
    { key: { parentConversationId: 1, rootMessageId: 1 }, options: { name: 'threads', sparse: true }, purpose: 'Threads' },
  ],
  conversationMembers: [
    { key: { conversationId: 1, userId: 1 }, options: { name: 'member_unique', unique: true }, purpose: 'DM membership checks' },
    { key: { userId: 1, hidden: 1, lastMessageAt: -1 }, options: { name: 'inbox' }, purpose: 'Conversation list' },
  ],
  messages: [
    { key: { conversationId: 1, seq: -1 }, options: { name: 'conv_seq_unique', unique: true }, purpose: 'History pagination' },
    {
      key: { senderId: 1, idempotencyKey: 1 },
      options: { name: 'idempotency_unique', unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
      purpose: 'Duplicate send prevention',
    },
    { key: { conversationId: 1, updatedAt: 1 }, options: { name: 'conv_updated' }, purpose: 'Reconciliation of edits/deletes' },
    {
      key: { conversationId: 1, pinned: 1, pinnedAt: -1 },
      options: { name: 'pins', partialFilterExpression: { pinned: true } },
      purpose: 'Pinned messages',
    },
    { key: { crewId: 1, createdAt: -1 }, options: { name: 'crew_activity', sparse: true }, purpose: 'Leaderboards, crew stats' },
    { key: { senderId: 1, createdAt: -1 }, options: { name: 'sender' }, purpose: 'Export/deletion, moderation' },
    { key: { threadId: 1, seq: 1 }, options: { name: 'thread', sparse: true }, purpose: 'Thread lookups' },
    {
      key: { content: 'text' },
      options: { name: 'message_text', default_language: 'none' },
      purpose: 'Message search (scoped by conversation in query)',
    },
  ],
  messageReactions: [
    {
      key: { messageId: 1, userId: 1, emoji: 1 },
      options: { name: 'reaction_unique', unique: true },
      purpose: 'One reaction per user/emoji',
    },
    { key: { userId: 1 }, options: { name: 'user' }, purpose: 'Export/deletion' },
  ],
  messageOutbox: [
    { key: { status: 1, nextAttemptAt: 1 }, options: { name: 'due' }, purpose: 'Retry worker' },
    { key: { expireAt: 1 }, options: { name: 'ttl', expireAfterSeconds: 0 }, purpose: 'Purge delivered events' },
  ],
  messageReadStates: [
    { key: { userId: 1, conversationId: 1 }, options: { name: 'state_unique', unique: true }, purpose: 'Unread counts' },
    { key: { conversationId: 1 }, options: { name: 'conversation' }, purpose: 'Mention fan-out' },
  ],
  events: [
    { key: { crewId: 1, deletedAt: 1, startsAt: 1 }, options: { name: 'crew_upcoming' }, purpose: 'Crew events' },
    { key: { visibility: 1, deletedAt: 1, startsAt: 1 }, options: { name: 'public_upcoming' }, purpose: 'Public events' },
    { key: { country: 1, startsAt: 1 }, options: { name: 'country' }, purpose: 'Events by country' },
    { key: { status: 1, startsAt: 1, remindersSentAt: 1 }, options: { name: 'reminders' }, purpose: 'Reminder job' },
  ],
  eventRSVPs: [
    { key: { eventId: 1, userId: 1 }, options: { name: 'rsvp_unique', unique: true }, purpose: 'RSVP state' },
    { key: { eventId: 1, status: 1, createdAt: 1 }, options: { name: 'attendees' }, purpose: 'Attendee list, waitlist' },
    { key: { userId: 1, status: 1 }, options: { name: 'mine' }, purpose: 'My events' },
  ],
  notifications: [
    { key: { userId: 1, createdAt: -1 }, options: { name: 'feed' }, purpose: 'Notification center' },
    { key: { userId: 1, readAt: 1 }, options: { name: 'unread' }, purpose: 'Unread badge' },
    { key: { userId: 1, groupKey: 1 }, options: { name: 'group', sparse: true }, purpose: 'Collapse repeats' },
    { key: { expireAt: 1 }, options: { name: 'ttl', expireAfterSeconds: 0 }, purpose: '180-day retention' },
  ],
  verificationRequests: [
    { key: { userId: 1, createdAt: -1 }, options: { name: 'mine' }, purpose: 'User status' },
    { key: { status: 1, submittedAt: 1 }, options: { name: 'queue' }, purpose: 'Review queue' },
    {
      key: { 'challenge.code': 1 },
      options: { name: 'challenge_unique', unique: true, partialFilterExpression: { 'challenge.code': { $type: 'string' } } },
      purpose: 'Challenge codes are never reused',
    },
    { key: { evidenceDeleteAfter: 1, evidenceDeletedAt: 1 }, options: { name: 'retention' }, purpose: 'Evidence deletion job' },
  ],
  verificationResults: [
    { key: { userId: 1, level: 1 }, options: { name: 'user_level' }, purpose: 'Badge derivation' },
    { key: { vehicleId: 1, level: 1 }, options: { name: 'vehicle_level', sparse: true }, purpose: 'Vehicle badges' },
  ],
  reports: [
    { key: { status: 1, scope: 1, createdAt: -1 }, options: { name: 'queue' }, purpose: 'Moderation queue' },
    { key: { crewId: 1, status: 1, createdAt: -1 }, options: { name: 'crew_queue', sparse: true }, purpose: 'Crew reports' },
    {
      key: { reporterId: 1, targetType: 1, targetId: 1 },
      options: { name: 'dedupe_unique', unique: true },
      purpose: 'One report per reporter/target',
    },
  ],
  moderationActions: [
    { key: { crewId: 1, createdAt: -1 }, options: { name: 'crew_history', sparse: true }, purpose: 'Crew moderation log' },
    { key: { targetUserId: 1, createdAt: -1 }, options: { name: 'target' }, purpose: 'User history' },
    { key: { scope: 1, createdAt: -1 }, options: { name: 'scope' }, purpose: 'Platform log' },
  ],
  appeals: [
    { key: { status: 1, createdAt: 1 }, options: { name: 'queue' }, purpose: 'Appeals queue' },
    { key: { userId: 1, moderationActionId: 1 }, options: { name: 'user_action_unique', unique: true }, purpose: 'One appeal per action' },
  ],
  auditLogs: [
    { key: { createdAt: -1 }, options: { name: 'recent' }, purpose: 'Admin audit view' },
    { key: { actorId: 1, createdAt: -1 }, options: { name: 'actor' }, purpose: 'Actor history' },
    { key: { crewId: 1, createdAt: -1 }, options: { name: 'crew', sparse: true }, purpose: 'Crew audit log' },
    { key: { createdAt: 1 }, options: { name: 'retention', expireAfterSeconds: 400 * 24 * 3600 }, purpose: '~13 month retention' },
  ],
  mediaAssets: [
    { key: { publicId: 1, provider: 1 }, options: { name: 'public_unique', unique: true }, purpose: 'Provider id dedupe' },
    { key: { ownerId: 1, purpose: 1, createdAt: -1 }, options: { name: 'owner_purpose' }, purpose: 'Ownership checks, export' },
    { key: { status: 1, updatedAt: 1 }, options: { name: 'cleanup' }, purpose: 'Deletion worker' },
  ],
  rateLimits: [{ key: { expiresAt: 1 }, options: { name: 'ttl', expireAfterSeconds: 0 }, purpose: 'Expire windows' }],
  jobLocks: [],
};

export interface EnsureIndexesReport {
  collection: string;
  created: string[];
}

/** Creates collections (if needed) and every declared index. Safe to run repeatedly. */
export async function ensureIndexes(db: Db): Promise<EnsureIndexesReport[]> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const reports: EnsureIndexesReport[] = [];
  for (const [key, defs] of Object.entries(INDEXES) as [CollectionName, IndexDefinition[]][]) {
    const name = COLLECTION_NAMES[key];
    if (!existing.has(name)) await db.createCollection(name);
    if (!defs.length) {
      reports.push({ collection: name, created: [] });
      continue;
    }
    const created = await db.collection(name).createIndexes(
      defs.map((d) => ({ key: d.key, ...(d.options ?? {}) })) as Parameters<ReturnType<Db['collection']>['createIndexes']>[0],
    );
    reports.push({ collection: name, created });
  }
  return reports;
}

/** Lists declared indexes missing from the database. */
export async function verifyIndexes(db: Db): Promise<{ collection: string; missing: string[] }[]> {
  const out: { collection: string; missing: string[] }[] = [];
  for (const [key, defs] of Object.entries(INDEXES) as [CollectionName, IndexDefinition[]][]) {
    const name = COLLECTION_NAMES[key];
    let present = new Set<string>();
    try {
      present = new Set((await db.collection(name).listIndexes().toArray()).map((i) => String(i.name)));
    } catch {
      // collection missing
    }
    const missing = defs.map((d) => d.options?.name ?? '').filter((n) => n && !present.has(n));
    if (missing.length) out.push({ collection: name, missing });
  }
  return out;
}
