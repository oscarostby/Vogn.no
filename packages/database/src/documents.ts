import type {
  AccountStatus,
  ApplicationForm,
  ApplicationStatus,
  AttendeeListVisibility,
  BuildUpdateKind,
  ChannelScopedPermission,
  ChannelType,
  ClaimedSpecs,
  ConversationKind,
  CrewCategory,
  CrewPermission,
  CrewRequirements,
  CrewVisibility,
  DmPrivacy,
  Drivetrain,
  EventStatus,
  EventVisibility,
  LocationVisibility,
  Locale,
  ManagedRole,
  MediaKind,
  MediaPurpose,
  MessageType,
  ModificationCategory,
  ModificationItem,
  NotificationType,
  OfficialVehicleData,
  PlatformRole,
  PublicBadge,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  RoleBadge,
  RsvpStatus,
  SocialLink,
  Transmission,
  UserSettings,
  VehicleVisibility,
  VerificationKind,
  VerificationLevel,
  VerificationStatus,
  WheelSpecs,
} from '@vogn/types';
import type { ObjectId } from 'mongodb';

/**
 * MongoDB document shapes. These are server-side only; API DTOs live in @vogn/types.
 * Conventions: `_id: ObjectId`, `createdAt`/`updatedAt` Dates, bounded arrays only.
 */

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaEmbed {
  mediaId: ObjectId;
  kind: MediaKind;
  url: string;
  width: number | null;
  height: number | null;
  mime: string | null;
  alt: string | null;
  thumbnailUrl: string | null;
}

/* ---------------------------------- users --------------------------------- */

export interface UserDoc extends Timestamps {
  _id: ObjectId;
  clerkUserId: string;
  username: string;
  usernameLower: string;
  displayName: string;
  avatar: MediaEmbed | null;
  banner: MediaEmbed | null;
  bio: string | null;
  country: string | null;
  language: Locale;
  pronouns: string | null;
  website: string | null;
  socialLinks: SocialLink[];
  favoriteBrands: string[];
  interests: string[];
  featuredVehicleId: ObjectId | null;
  accentColor: string | null;
  onboardingCompleted: boolean;
  platformRole: PlatformRole;
  status: AccountStatus;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  /** Derived verification levels (source of truth: verificationResults). */
  verificationLevels: VerificationLevel[];
  /** Badges the user chose to display (derived from levels + settings + staff role). */
  publicBadges: PublicBadge[];
  emailVerified: boolean;
  phoneVerified: boolean;
  lastActiveAt: Date | null;
  usernameChangedAt: Date | null;
  deletionRequestedAt: Date | null;
  deletedAt: Date | null;
}

export interface UsernameRedirectDoc {
  _id: ObjectId;
  usernameLower: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

export interface UserSettingsDoc extends Timestamps, UserSettings {
  _id: ObjectId;
  userId: ObjectId;
}

export interface UserConnectionDoc extends Timestamps {
  _id: ObjectId;
  fromUserId: ObjectId;
  toUserId: ObjectId;
  kind: 'friend' | 'follow';
  status: 'pending' | 'accepted';
}

export interface UserBlockDoc {
  _id: ObjectId;
  blockerId: ObjectId;
  blockedId: ObjectId;
  createdAt: Date;
}

export interface PushTokenDoc extends Timestamps {
  _id: ObjectId;
  userId: ObjectId;
  token: string;
  platform: 'ios' | 'android';
  lastUsedAt: Date;
}

/* -------------------------------- vehicles -------------------------------- */

export interface VehicleDoc extends Timestamps {
  _id: ObjectId;
  ownerId: ObjectId;
  make: string;
  makeLower: string;
  model: string;
  modelLower: string;
  generation: string | null;
  year: number | null;
  trim: string | null;
  nickname: string | null;
  description: string | null;
  color: string | null;
  drivetrain: Drivetrain | null;
  transmission: Transmission | null;
  specs: ClaimedSpecs;
  wheels: WheelSpecs;
  suspension: string | null;
  exhaust: string | null;
  ecuTuning: string | null;
  turbo: string | null;
  interior: string | null;
  audio: string | null;
  categories: ModificationCategory[];
  modifications: ModificationItem[];
  /** Lower-cased category names used for discovery filtering. */
  modCategoryKeys: string[];
  coverImage: MediaEmbed | null;
  /** Ordered gallery (bounded to 60). */
  gallery: MediaEmbed[];
  officialData: OfficialVehicleData | null;
  visibility: VehicleVisibility;
  visibleCrewIds: ObjectId[];
  likesEnabled: boolean;
  commentsEnabled: boolean;
  showExpenses: boolean;
  likeCount: number;
  commentCount: number;
  verification: {
    specsConfirmed: boolean;
    accessReviewed: boolean;
    ownershipEvidenceReviewed: boolean;
  };
  ownerCountry: string | null;
  lastBuildUpdateAt: Date | null;
  deletedAt: Date | null;
}

/** Encrypted identifiers, isolated from the public vehicle document. */
export interface VehiclePrivateDoc extends Timestamps {
  _id: ObjectId;
  vehicleId: ObjectId;
  ownerId: ObjectId;
  countryCode: string;
  registrationEnc: string | null;
  vinEnc: string | null;
  /** Keyed HMAC of normalised registration for duplicate detection without decryption. */
  registrationHash: string | null;
  vinHash: string | null;
}

export interface BuildUpdateDoc extends Timestamps {
  _id: ObjectId;
  vehicleId: ObjectId;
  authorId: ObjectId;
  kind: BuildUpdateKind;
  title: string;
  body: string | null;
  occurredAt: Date;
  media: MediaEmbed[];
  before: MediaEmbed | null;
  after: MediaEmbed | null;
  cost: { amount: number; currency: string } | null;
}

export interface VehicleLikeDoc {
  _id: ObjectId;
  vehicleId: ObjectId;
  userId: ObjectId;
  createdAt: Date;
}

export interface VehicleCommentDoc extends Timestamps {
  _id: ObjectId;
  vehicleId: ObjectId;
  authorId: ObjectId;
  body: string;
  deletedAt: Date | null;
}

/* ---------------------------------- crews --------------------------------- */

export interface CrewDoc extends Timestamps {
  _id: ObjectId;
  slug: string;
  name: string;
  description: string | null;
  icon: MediaEmbed | null;
  banner: MediaEmbed | null;
  category: CrewCategory;
  tags: string[];
  region: string | null;
  country: string | null;
  language: string;
  visibility: CrewVisibility;
  ownerId: ObjectId;
  memberCount: number;
  /** Rolling activity score for "trending" (messages + joins over the last days, decayed by cron). */
  activityScore: number;
  rules: string[];
  requirements: CrewRequirements;
  applicationForm: ApplicationForm | null;
  defaultRoleId: ObjectId;
  accentColor: string | null;
  publishedThemeVersion: number | null;
  deletedAt: Date | null;
}

export interface CrewSlugRedirectDoc {
  _id: ObjectId;
  slug: string;
  crewId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

export interface CrewRoleDoc extends Timestamps {
  _id: ObjectId;
  crewId: ObjectId;
  name: string;
  color: string | null;
  badge: RoleBadge | null;
  position: number;
  permissions: CrewPermission[];
  managed: ManagedRole | null;
  mentionable: boolean;
  hoist: boolean;
  isDefault: boolean;
}

export interface CrewMemberDoc extends Timestamps {
  _id: ObjectId;
  crewId: ObjectId;
  userId: ObjectId;
  roleIds: ObjectId[];
  nickname: string | null;
  accentColor: string | null;
  status: 'active' | 'banned' | 'left' | 'kicked';
  timeoutUntil: Date | null;
  invitedBy: ObjectId | null;
  joinedAt: Date;
  notificationLevel: 'all' | 'mentions' | 'nothing';
  mutedUntil: Date | null;
  suppressEveryone: boolean;
  banReason: string | null;
}

export interface PermissionOverwriteDoc {
  roleId: ObjectId;
  allow: ChannelScopedPermission[];
  deny: ChannelScopedPermission[];
}

export interface CrewChannelDoc extends Timestamps {
  _id: ObjectId;
  crewId: ObjectId;
  conversationId: ObjectId | null;
  name: string;
  type: ChannelType;
  parentId: ObjectId | null;
  position: number;
  topic: string | null;
  icon: string | null;
  locked: boolean;
  slowmodeSeconds: number;
  overwrites: PermissionOverwriteDoc[];
  deletedAt: Date | null;
}

export interface CrewInvitationDoc {
  _id: ObjectId;
  crewId: ObjectId;
  code: string;
  createdBy: ObjectId;
  maxUses: number | null;
  uses: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CrewApplicationDoc extends Timestamps {
  _id: ObjectId;
  crewId: ObjectId;
  userId: ObjectId;
  answers: { questionId: string; label: string; value: string | string[] }[];
  sharedVerification: { levels: string[]; vehicleIds: ObjectId[] } | null;
  consentAt: Date;
  referralCode: string | null;
  status: ApplicationStatus;
  reviewedBy: ObjectId | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
}

export interface CrewThemeDoc {
  _id: ObjectId;
  crewId: ObjectId;
  /** Validated ThemeManifest (stored as plain JSON). */
  draft: Record<string, unknown>;
  draftUpdatedAt: Date;
  draftUpdatedBy: ObjectId;
  published: Record<string, unknown> | null;
  publishedVersion: number | null;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface CrewThemeVersionDoc {
  _id: ObjectId;
  crewId: ObjectId;
  version: number;
  manifest: Record<string, unknown>;
  note: string | null;
  publishedBy: ObjectId;
  publishedAt: Date;
  restoredFrom: number | null;
}

export interface ThemeListingDoc extends Timestamps {
  _id: ObjectId;
  slug: string;
  name: string;
  description: string | null;
  authorId: ObjectId;
  sourceCrewId: ObjectId | null;
  manifest: Record<string, unknown>;
  schemaVersion: number;
  version: number;
  tags: string[];
  previewColors: string[];
  installs: number;
  ratingSum: number;
  ratingCount: number;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  reviewNote: string | null;
}

export interface ThemeRatingDoc {
  _id: ObjectId;
  themeId: ObjectId;
  userId: ObjectId;
  rating: number;
  createdAt: Date;
}

export interface PollVoteDoc {
  _id: ObjectId;
  crewId: ObjectId;
  /** `${widgetId}:${optionsHash}` so editing poll options starts a fresh vote. */
  pollKey: string;
  userId: ObjectId;
  optionIndex: number;
  createdAt: Date;
}

/* -------------------------------- messaging ------------------------------- */

export interface ConversationDoc extends Timestamps {
  _id: ObjectId;
  kind: ConversationKind;
  crewId: ObjectId | null;
  channelId: ObjectId | null;
  /** Sorted participant ids joined with ":" for 1:1 DMs (unique). */
  dmKey: string | null;
  name: string | null;
  createdBy: ObjectId | null;
  parentConversationId: ObjectId | null;
  rootMessageId: ObjectId | null;
  memberCount: number;
  messageSeq: number;
  lastMessageAt: Date | null;
  lastMessageId: ObjectId | null;
  lastMessagePreview: { senderName: string | null; text: string } | null;
}

export interface ConversationMemberDoc extends Timestamps {
  _id: ObjectId;
  conversationId: ObjectId;
  userId: ObjectId;
  role: 'owner' | 'member';
  mutedUntil: Date | null;
  muted: boolean;
  hidden: boolean;
  /** Mirrors conversation.lastMessageAt for efficient "my conversations" sorting. */
  lastMessageAt: Date | null;
  leftAt: Date | null;
}

export interface MessageAttachmentDoc {
  mediaId: ObjectId;
  kind: MediaKind;
  url: string;
  thumbnailUrl: string | null;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}

export interface MessageDoc {
  _id: ObjectId;
  conversationId: ObjectId;
  /** Denormalised for crew-wide queries (leaderboards, search, moderation). */
  crewId: ObjectId | null;
  seq: number;
  senderId: ObjectId | null;
  type: MessageType;
  content: string;
  mentions: { userIds: ObjectId[]; roleIds: ObjectId[]; everyone: boolean };
  attachments: MessageAttachmentDoc[];
  embeds: {
    kind: 'vehicle' | 'event' | 'link';
    refId: ObjectId | null;
    url: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
  }[];
  replyToId: ObjectId | null;
  threadId: ObjectId | null;
  threadReplyCount: number;
  threadLastReplyAt: Date | null;
  /** Bounded summary (≤ 20 distinct emoji); per-user rows live in messageReactions. */
  reactions: { emoji: string; count: number }[];
  pinned: boolean;
  pinnedAt: Date | null;
  pinnedBy: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: ObjectId | null;
  moderation: { flagged: boolean; removedByModerator: boolean; reason: string | null } | null;
  idempotencyKey: string | null;
}

export interface MessageReactionDoc {
  _id: ObjectId;
  messageId: ObjectId;
  conversationId: ObjectId;
  userId: ObjectId;
  emoji: string;
  createdAt: Date;
}

export interface OutboxDoc {
  _id: ObjectId;
  channel: string;
  name: string;
  payload: unknown;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
  /** TTL anchor; set once sent (or permanently failed). */
  expireAt: Date | null;
}

export interface ReadStateDoc {
  _id: ObjectId;
  userId: ObjectId;
  conversationId: ObjectId;
  lastReadSeq: number;
  mentionCount: number;
  updatedAt: Date;
}

/* --------------------------------- events --------------------------------- */

export interface EventDoc extends Timestamps {
  _id: ObjectId;
  crewId: ObjectId;
  organizerId: ObjectId;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  country: string | null;
  city: string | null;
  location: {
    name: string;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    notes: string | null;
  } | null;
  locationVisibility: LocationVisibility;
  visibility: EventVisibility;
  attendeeListVisibility: AttendeeListVisibility;
  rsvpLimit: number | null;
  coverImage: MediaEmbed | null;
  safetyNotes: string | null;
  status: EventStatus;
  goingCount: number;
  interestedCount: number;
  remindersSentAt: Date | null;
  deletedAt: Date | null;
}

export interface EventRsvpDoc extends Timestamps {
  _id: ObjectId;
  eventId: ObjectId;
  userId: ObjectId;
  status: RsvpStatus;
}

/* ------------------------------ notifications ----------------------------- */

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  actorId: ObjectId | null;
  crewId: ObjectId | null;
  title: string;
  body: string | null;
  link: string | null;
  /** Collapse key: repeated events (e.g. many reactions) update one notification. */
  groupKey: string | null;
  readAt: Date | null;
  createdAt: Date;
  expireAt: Date;
}

/* ------------------------------ verification ------------------------------ */

export interface VerificationRequestDoc extends Timestamps {
  _id: ObjectId;
  userId: ObjectId;
  vehicleId: ObjectId | null;
  kind: VerificationKind;
  status: VerificationStatus;
  countryCode: string | null;
  provider: string | null;
  challenge: { code: string; expiresAt: Date; usedAt: Date | null } | null;
  evidence: { id: string; key: string; mime: string; size: number; uploadedAt: Date | null }[];
  submittedAt: Date | null;
  reviewerId: ObjectId | null;
  claimedAt: Date | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  /** Evidence is deleted from private storage after this date (retention policy). */
  evidenceDeleteAfter: Date | null;
  evidenceDeletedAt: Date | null;
  providerResult: { matched: boolean; summary: string } | null;
}

export interface VerificationResultDoc {
  _id: ObjectId;
  userId: ObjectId;
  vehicleId: ObjectId | null;
  level: VerificationLevel;
  provider: string;
  method: string;
  requestId: ObjectId | null;
  decidedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/* ------------------------------- moderation ------------------------------- */

export interface ReportDoc extends Timestamps {
  _id: ObjectId;
  reporterId: ObjectId;
  targetType: ReportTargetType;
  targetId: ObjectId;
  targetUserId: ObjectId | null;
  crewId: ObjectId | null;
  reason: ReportReason;
  details: string | null;
  excerpt: string | null;
  status: ReportStatus;
  assignedTo: ObjectId | null;
  resolvedAt: Date | null;
  resolvedBy: ObjectId | null;
  resolution: string | null;
  /** Reports about crew content are visible to crew moderators unless escalated to the platform. */
  scope: 'crew' | 'platform';
}

export interface ModerationActionDoc {
  _id: ObjectId;
  scope: 'crew' | 'platform';
  crewId: ObjectId | null;
  actorId: ObjectId;
  targetUserId: ObjectId | null;
  action: string;
  reason: string | null;
  targetRef: { type: string; id: ObjectId } | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface AppealDoc extends Timestamps {
  _id: ObjectId;
  userId: ObjectId;
  moderationActionId: ObjectId;
  message: string;
  status: 'open' | 'upheld' | 'overturned';
  decidedBy: ObjectId | null;
  decidedAt: Date | null;
  note: string | null;
}

export interface AuditLogDoc {
  _id: ObjectId;
  actorId: ObjectId | null;
  action: string;
  targetType: string | null;
  targetId: ObjectId | null;
  crewId: ObjectId | null;
  metadata: Record<string, unknown>;
  /** Truncated/hashed request context — never raw IPs. */
  requestHash: string | null;
  createdAt: Date;
}

/* ---------------------------------- media --------------------------------- */

export interface MediaAssetDoc extends Timestamps {
  _id: ObjectId;
  ownerId: ObjectId;
  provider: 'cloudinary' | 'r2';
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
  kind: MediaKind;
  url: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  purpose: MediaPurpose;
  contextId: ObjectId | null;
  originalFilename: string | null;
  status: 'ready' | 'deleting' | 'deleted';
  attachedTo: { type: string; id: ObjectId } | null;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export interface JobLockDoc {
  _id: string;
  lockedUntil: Date;
  lastRunAt: Date | null;
}
