import type { AudienceVisibility, ColorScheme, Id, ISODate, Locale, MediaRef, UnitSystem } from './common';
import type { CrewSummary } from './crew';
import type { VehicleSummary } from './vehicle';
import type { VerificationLevel } from './verification';

export type PlatformRole = 'user' | 'support' | 'moderator' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'deleted';
export type DmPrivacy = 'everyone' | 'connections' | 'crew_members' | 'nobody';

export const SOCIAL_PLATFORMS = [
  'instagram',
  'youtube',
  'tiktok',
  'x',
  'facebook',
  'twitch',
  'website',
  'other',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

/** Badges a user has chosen to display publicly (derived from verification results + settings). */
export type PublicBadge = VerificationLevel | 'staff';

export interface UserSummary {
  id: Id;
  username: string;
  displayName: string;
  avatar: MediaRef | null;
  accentColor: string | null;
  badges: PublicBadge[];
}

export type FriendStatus = 'none' | 'pending_outgoing' | 'pending_incoming' | 'friends';

export interface RelationshipState {
  isSelf: boolean;
  friendStatus: FriendStatus;
  following: boolean;
  followedBy: boolean;
  blocked: boolean;
}

export interface PublicProfile extends UserSummary {
  /** 'limited' when the viewer may only see the summary (visibility restrictions). */
  access: 'full' | 'limited';
  bio: string | null;
  banner: MediaRef | null;
  country: string | null;
  pronouns: string | null;
  website: string | null;
  socialLinks: SocialLink[];
  favoriteBrands: string[];
  interests: string[];
  featuredVehicle: VehicleSummary | null;
  joinedAt: ISODate;
  relationship: RelationshipState;
  sharedCrews: CrewSummary[];
  stats: { vehicles: number; crews: number; friends: number };
  canMessage: boolean;
  canSendFriendRequest: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // HH:MM
  end: string; // HH:MM
  timezone: string;
}

export interface NotificationChannelPreferences {
  directMessages: boolean;
  mentions: boolean;
  replies: boolean;
  reactions: boolean;
  crewInvitations: boolean;
  membership: boolean;
  verification: boolean;
  events: boolean;
  announcements: boolean;
  social: boolean;
  security: boolean;
}

export interface NotificationPreferences {
  inApp: NotificationChannelPreferences;
  push: NotificationChannelPreferences;
  email: NotificationChannelPreferences;
  quietHours: QuietHours;
}

export interface UserSettings {
  profileVisibility: AudienceVisibility;
  onlineStatusVisibility: 'everyone' | 'connections' | 'crew_members' | 'nobody';
  activityVisibility: AudienceVisibility;
  garageVisibility: 'public' | 'connections' | 'crews' | 'private';
  dmPrivacy: DmPrivacy;
  friendRequests: 'everyone' | 'crew_members' | 'nobody';
  showVerificationBadges: boolean;
  allowFollowers: boolean;
  locale: Locale;
  units: UnitSystem;
  colorScheme: ColorScheme;
  reducedMotion: 'system' | 'reduce' | 'no-preference';
  notifications: NotificationPreferences;
}

export interface MeProfile {
  id: Id;
  clerkUserId: string;
  username: string;
  displayName: string;
  avatar: MediaRef | null;
  banner: MediaRef | null;
  bio: string | null;
  country: string | null;
  language: Locale;
  pronouns: string | null;
  website: string | null;
  socialLinks: SocialLink[];
  favoriteBrands: string[];
  interests: string[];
  featuredVehicleId: Id | null;
  accentColor: string | null;
  onboardingCompleted: boolean;
  platformRole: PlatformRole;
  status: AccountStatus;
  verificationLevels: VerificationLevel[];
  settings: UserSettings;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** Returned by GET /me when the Clerk user has no VOGN profile yet. */
export interface OnboardingState {
  needsOnboarding: true;
  suggestedUsername: string | null;
  suggestedDisplayName: string | null;
  emailVerified: boolean;
}

export interface ConnectionItem {
  user: UserSummary;
  status: FriendStatus;
  since: ISODate;
}

export interface DataExportManifest {
  generatedAt: ISODate;
  format: 'vogn-export/v1';
  sections: string[];
}
