import type {
  BuildFeedItem,
  ConversationSummary,
  CrewSummary,
  EventSummary,
  Id,
  ISODate,
  MediaRef,
  UserSummary,
  VehicleSummary,
} from '@vogn/types';
import type { ThemeManifest } from '@vogn/theme-engine';

/** Additional response DTOs that depend on the theme engine or aggregate several domains. */

export interface CrewThemeState {
  crewId: Id;
  draft: ThemeManifest;
  draftUpdatedAt: ISODate;
  published: ThemeManifest | null;
  publishedVersion: number | null;
  publishedAt: ISODate | null;
  hasUnpublishedChanges: boolean;
}

export interface PublishedCrewTheme {
  crewId: Id;
  manifest: ThemeManifest;
  version: number | null;
}

export interface ThemeVersionSummary {
  version: number;
  note: string | null;
  publishedAt: ISODate;
  publishedBy: UserSummary | null;
  restoredFrom: number | null;
  name: string;
}

export interface ThemeListing {
  id: Id;
  slug: string;
  name: string;
  description: string | null;
  author: UserSummary | null;
  tags: string[];
  previewColors: string[];
  installs: number;
  rating: number | null;
  ratingCount: number;
  version: number;
  schemaVersion: number;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  createdAt: ISODate;
}

export interface ThemeListingDetail extends ThemeListing {
  manifest: ThemeManifest;
  viewerRating: number | null;
}

export interface MediaSignResponse {
  /** Direct-upload endpoint (Cloudinary). */
  uploadUrl: string;
  /** Form fields to send with the file (signed; contains no secrets). */
  fields: Record<string, string>;
  /** Opaque token binding this upload to the user/purpose; returned on completion. */
  uploadToken: string;
  maxBytes: number;
}

export interface PrivateUploadResponse {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  evidenceId: string;
  expiresAt: ISODate;
}

export interface HomeFeed {
  crews: (CrewSummary & { unreadCount: number; mentionCount: number })[];
  upcomingEvents: EventSummary[];
  garage: VehicleSummary[];
  builds: BuildFeedItem[];
  conversations: ConversationSummary[];
  onboarding: { hasAvatar: boolean; hasVehicle: boolean; hasCrew: boolean };
}

export interface SearchResults {
  users: UserSummary[];
  crews: CrewSummary[];
  vehicles: (VehicleSummary & { owner: UserSummary })[];
}

/* ------------------------------ widget payloads ------------------------------ */

export interface WidgetPost {
  id: Id;
  channelId: Id | null;
  channelName: string | null;
  author: UserSummary | null;
  text: string;
  createdAt: ISODate;
  replyCount: number;
  reactionCount: number;
}

export interface WidgetVehicle extends VehicleSummary {
  owner: UserSummary;
}

/** Server-computed data per widget type (keyed by widget id in `CrewWidgetPayload.data`). */
export interface WidgetDataByType {
  announcements: { items: WidgetPost[] };
  member_count: { members: number; online: number | null; avatars: UserSummary[] };
  featured_member: { user: UserSummary | null; vehicle: VehicleSummary | null };
  featured_car: { vehicle: WidgetVehicle | null };
  vehicle_gallery: { vehicles: WidgetVehicle[] };
  build_projects: { items: BuildFeedItem[] };
  upcoming_meets: { events: EventSummary[] };
  event_calendar: { events: EventSummary[] };
  countdown: { event: EventSummary | null };
  poll: PollResult;
  rules: { items: string[] };
  leaderboard: { entries: { user: UserSummary; value: number }[]; metric: string };
  popular_discussions: { items: WidgetPost[] };
  channel_list: { channels: { id: Id; name: string; type: string; topic: string | null; icon: string | null }[] };
  stats: { members: number; channels: number; builds: number; events: number; founded: ISODate };
}

export type WidgetData = Record<string, WidgetDataByType[keyof WidgetDataByType] | undefined>;

export interface CrewWidgetPayload {
  crewId: Id;
  generatedAt: ISODate;
  data: WidgetData;
}

export interface PollResult {
  pollKey: string;
  counts: number[];
  total: number;
  viewerChoice: number | null;
  closed: boolean;
}

export interface UploadedMedia extends MediaRef {
  purpose: string;
}

export interface ProviderStatusDto {
  name: string;
  configured: boolean;
  required: boolean;
  detail: string;
}

export interface SystemHealth {
  database: { ok: boolean; latencyMs: number | null };
  outbox: { pending: number; failed: number; oldestPendingAt: ISODate | null };
  providers: ProviderStatusDto[];
  version: string;
}

export interface VoiceTokenResponse {
  url: string;
  token: string;
  room: string;
}
