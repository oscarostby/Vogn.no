import type { Collection, Db, Document } from 'mongodb';
import type * as D from './documents';

export const COLLECTION_NAMES = {
  users: 'users',
  usernameRedirects: 'usernameRedirects',
  userSettings: 'userSettings',
  userConnections: 'userConnections',
  userBlocks: 'userBlocks',
  pushTokens: 'pushTokens',
  vehicles: 'vehicles',
  vehiclePrivate: 'vehiclePrivate',
  vehicleBuildUpdates: 'vehicleBuildUpdates',
  vehicleLikes: 'vehicleLikes',
  vehicleComments: 'vehicleComments',
  crews: 'crews',
  crewSlugRedirects: 'crewSlugRedirects',
  crewMembers: 'crewMembers',
  crewRoles: 'crewRoles',
  crewChannels: 'crewChannels',
  crewInvitations: 'crewInvitations',
  crewApplications: 'crewApplications',
  crewThemes: 'crewThemes',
  crewThemeVersions: 'crewThemeVersions',
  themeMarketplace: 'themeMarketplace',
  themeRatings: 'themeRatings',
  pollVotes: 'pollVotes',
  conversations: 'conversations',
  conversationMembers: 'conversationMembers',
  messages: 'messages',
  messageReactions: 'messageReactions',
  messageOutbox: 'messageOutbox',
  messageReadStates: 'messageReadStates',
  events: 'events',
  eventRSVPs: 'eventRSVPs',
  notifications: 'notifications',
  verificationRequests: 'verificationRequests',
  verificationResults: 'verificationResults',
  reports: 'reports',
  moderationActions: 'moderationActions',
  appeals: 'appeals',
  auditLogs: 'auditLogs',
  mediaAssets: 'mediaAssets',
  rateLimits: 'rateLimits',
  jobLocks: 'jobLocks',
} as const;

export type CollectionName = keyof typeof COLLECTION_NAMES;

export interface Collections {
  users: Collection<D.UserDoc>;
  usernameRedirects: Collection<D.UsernameRedirectDoc>;
  userSettings: Collection<D.UserSettingsDoc>;
  userConnections: Collection<D.UserConnectionDoc>;
  userBlocks: Collection<D.UserBlockDoc>;
  pushTokens: Collection<D.PushTokenDoc>;
  vehicles: Collection<D.VehicleDoc>;
  vehiclePrivate: Collection<D.VehiclePrivateDoc>;
  vehicleBuildUpdates: Collection<D.BuildUpdateDoc>;
  vehicleLikes: Collection<D.VehicleLikeDoc>;
  vehicleComments: Collection<D.VehicleCommentDoc>;
  crews: Collection<D.CrewDoc>;
  crewSlugRedirects: Collection<D.CrewSlugRedirectDoc>;
  crewMembers: Collection<D.CrewMemberDoc>;
  crewRoles: Collection<D.CrewRoleDoc>;
  crewChannels: Collection<D.CrewChannelDoc>;
  crewInvitations: Collection<D.CrewInvitationDoc>;
  crewApplications: Collection<D.CrewApplicationDoc>;
  crewThemes: Collection<D.CrewThemeDoc>;
  crewThemeVersions: Collection<D.CrewThemeVersionDoc>;
  themeMarketplace: Collection<D.ThemeListingDoc>;
  themeRatings: Collection<D.ThemeRatingDoc>;
  pollVotes: Collection<D.PollVoteDoc>;
  conversations: Collection<D.ConversationDoc>;
  conversationMembers: Collection<D.ConversationMemberDoc>;
  messages: Collection<D.MessageDoc>;
  messageReactions: Collection<D.MessageReactionDoc>;
  messageOutbox: Collection<D.OutboxDoc>;
  messageReadStates: Collection<D.ReadStateDoc>;
  events: Collection<D.EventDoc>;
  eventRSVPs: Collection<D.EventRsvpDoc>;
  notifications: Collection<D.NotificationDoc>;
  verificationRequests: Collection<D.VerificationRequestDoc>;
  verificationResults: Collection<D.VerificationResultDoc>;
  reports: Collection<D.ReportDoc>;
  moderationActions: Collection<D.ModerationActionDoc>;
  appeals: Collection<D.AppealDoc>;
  auditLogs: Collection<D.AuditLogDoc>;
  mediaAssets: Collection<D.MediaAssetDoc>;
  rateLimits: Collection<D.RateLimitDoc>;
  jobLocks: Collection<D.JobLockDoc>;
}

const cache = new WeakMap<Db, Collections>();

/** Typed collection accessors for a database handle (memoised per Db instance). */
export function collections(db: Db): Collections {
  const hit = cache.get(db);
  if (hit) return hit;
  const entries = Object.entries(COLLECTION_NAMES).map(([key, name]) => [key, db.collection<Document>(name)]);
  const result = Object.fromEntries(entries) as unknown as Collections;
  cache.set(db, result);
  return result;
}
