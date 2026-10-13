/** String form of a MongoDB ObjectId as exposed by the API. */
export type Id = string;
/** ISO-8601 timestamp string (UTC). */
export type ISODate = string;

export const LOCALES = ['en', 'nb', 'sv', 'da', 'de', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export type UnitSystem = 'metric' | 'imperial';
export type ColorScheme = 'dark' | 'light' | 'system';

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'ONBOARDING_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'CONFIG_MISSING'
  | 'PROVIDER_ERROR'
  | 'ACCOUNT_SUSPENDED'
  | 'GONE'
  | 'INTERNAL';

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: { nextCursor?: string | null; [key: string]: unknown };
}

export interface ApiErrorBody {
  error: ApiErrorPayload;
}

export type MediaKind = 'image' | 'video' | 'file';

export type MediaPurpose =
  | 'avatar'
  | 'banner'
  | 'vehicle'
  | 'build_update'
  | 'crew_icon'
  | 'crew_banner'
  | 'crew_media'
  | 'message'
  | 'event_cover'
  | 'theme_background'
  | 'verification_evidence';

/** Reference to a stored media asset as rendered by clients. */
export interface MediaRef {
  id: Id;
  kind: MediaKind;
  url: string;
  width: number | null;
  height: number | null;
  mime: string | null;
  alt: string | null;
  /** Poster/thumbnail for videos. */
  thumbnailUrl: string | null;
}

export type AudienceVisibility = 'public' | 'members' | 'connections' | 'private';
