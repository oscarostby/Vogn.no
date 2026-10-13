import { NOTIFICATION_TYPES, REPORT_REASONS, REPORT_TARGET_TYPES, VERIFICATION_KINDS } from '@vogn/types';
import { z } from 'zod';
import {
  countryCode,
  isoDateTime,
  multiLine,
  objectId,
  optionalMultiLine,
  optionalSingleLine,
  singleLine,
  timeZone,
} from './common';

/* ---------------------------------- media --------------------------------- */

export const PUBLIC_MEDIA_PURPOSES = [
  'avatar',
  'banner',
  'vehicle',
  'build_update',
  'crew_icon',
  'crew_banner',
  'crew_media',
  'message',
  'event_cover',
  'theme_background',
] as const;

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic'] as const;
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const FILE_MIME_TYPES = ['application/pdf', 'text/plain'] as const;

export const MEDIA_LIMITS = {
  imageBytes: 15 * 1024 * 1024,
  videoBytes: 100 * 1024 * 1024,
  fileBytes: 25 * 1024 * 1024,
  evidenceBytes: 15 * 1024 * 1024,
} as const;

export const mediaSignSchema = z.object({
  purpose: z.enum(PUBLIC_MEDIA_PURPOSES),
  mime: z.enum([...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES, ...FILE_MIME_TYPES]),
  size: z.number().int().min(1).max(MEDIA_LIMITS.videoBytes),
  filename: optionalSingleLine(200),
  /** Context used for authorization (e.g. crew id for crew media, conversation id for chat). */
  contextId: objectId.optional(),
});
export type MediaSignInput = z.input<typeof mediaSignSchema>;

export const mediaCompleteSchema = z.object({
  uploadToken: z.string().min(10).max(2000),
  publicId: z.string().min(1).max(300),
  version: z.coerce.number().int().min(1),
  signature: z.string().regex(/^[a-f0-9]{40,64}$/),
  resourceType: z.enum(['image', 'video', 'raw']),
  format: z.string().max(20).optional(),
  bytes: z.number().int().min(1),
  width: z.number().int().min(1).max(50_000).nullable().optional(),
  height: z.number().int().min(1).max(50_000).nullable().optional(),
  originalFilename: optionalSingleLine(200),
});
export type MediaCompleteInput = z.input<typeof mediaCompleteSchema>;

/* ------------------------------ verification ------------------------------ */

export const verificationStartSchema = z.object({
  kind: z.enum(VERIFICATION_KINDS),
  vehicleId: objectId.nullable().optional(),
  countryCode: countryCode.nullable().optional(),
});
export type VerificationStartInput = z.input<typeof verificationStartSchema>;

export const EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;

export const evidenceUploadSchema = z.object({
  mime: z.enum(EVIDENCE_MIME_TYPES),
  size: z.number().int().min(1).max(MEDIA_LIMITS.evidenceBytes),
});

export const evidenceCompleteSchema = z.object({ evidenceId: z.string().regex(/^[a-f0-9]{32}$/) });

export const verificationReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: optionalSingleLine(500),
});

/* --------------------------------- events --------------------------------- */

export const eventLocationSchema = z.object({
  name: singleLine(1, 120),
  address: optionalSingleLine(200).transform((v) => v ?? null),
  city: optionalSingleLine(80).transform((v) => v ?? null),
  latitude: z.number().min(-90).max(90).nullable().optional().transform((v) => v ?? null),
  longitude: z.number().min(-180).max(180).nullable().optional().transform((v) => v ?? null),
  notes: optionalMultiLine(500).transform((v) => v ?? null),
});

const eventFields = {
  title: singleLine(3, 100),
  description: optionalMultiLine(5000),
  startsAt: isoDateTime,
  endsAt: isoDateTime.nullable().optional(),
  timezone: timeZone,
  country: countryCode.nullable().optional(),
  city: optionalSingleLine(80),
  location: eventLocationSchema.nullable().optional(),
  locationVisibility: z.enum(['public', 'members', 'attendees']).default('members'),
  visibility: z.enum(['public', 'crew', 'private']).default('crew'),
  attendeeListVisibility: z.enum(['public', 'members', 'organizers']).default('members'),
  rsvpLimit: z.number().int().min(1).max(100_000).nullable().optional(),
  coverMediaId: objectId.nullable().optional(),
  safetyNotes: optionalMultiLine(1000),
};

export const eventCreateSchema = z
  .object({ crewId: objectId, ...eventFields })
  .refine((e) => !e.endsAt || new Date(e.endsAt) > new Date(e.startsAt), {
    message: 'validation.event.endsBeforeStart',
    path: ['endsAt'],
  });
export type EventCreateInput = z.input<typeof eventCreateSchema>;

export const eventUpdateSchema = z
  .object({
    ...eventFields,
    title: eventFields.title.optional(),
    startsAt: isoDateTime.optional(),
    timezone: timeZone.optional(),
    locationVisibility: z.enum(['public', 'members', 'attendees']).optional(),
    visibility: z.enum(['public', 'crew', 'private']).optional(),
    attendeeListVisibility: z.enum(['public', 'members', 'organizers']).optional(),
    status: z.enum(['scheduled', 'cancelled']).optional(),
    announce: z.boolean().optional(),
  })
  .refine((e) => !e.endsAt || !e.startsAt || new Date(e.endsAt) > new Date(e.startsAt), {
    message: 'validation.event.endsBeforeStart',
    path: ['endsAt'],
  });

export const rsvpSchema = z.object({ status: z.enum(['going', 'interested', 'not_going']) });

export const eventListQuery = z.object({
  crewId: objectId.optional(),
  country: countryCode.optional(),
  scope: z.enum(['upcoming', 'past', 'mine']).default('upcoming'),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/* ------------------------------ notifications ----------------------------- */

export const notificationsReadSchema = z.union([
  z.object({ ids: z.array(objectId).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
]);

export const pushTokenSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/, 'validation.pushToken'),
  platform: z.enum(['ios', 'android']),
});

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

/* ------------------------------- moderation ------------------------------- */

export const reportCreateSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: optionalMultiLine(1000),
});
export type ReportCreateInput = z.input<typeof reportCreateSchema>;

export const reportResolveSchema = z.object({
  status: z.enum(['reviewing', 'actioned', 'dismissed']),
  resolution: optionalSingleLine(500),
  removeContent: z.boolean().optional(),
});

export const suspendUserSchema = z.object({
  reason: singleLine(3, 500),
  until: isoDateTime.nullable().optional(),
});

export const appealCreateSchema = z.object({
  moderationActionId: objectId,
  message: multiLine(10, 2000),
});

export const appealDecisionSchema = z.object({
  decision: z.enum(['upheld', 'overturned']),
  note: optionalSingleLine(500),
});

export const searchQuery = z.object({
  q: z.string().trim().min(1).max(80),
  type: z.enum(['all', 'users', 'crews', 'vehicles']).default('all'),
  limit: z.coerce.number().int().min(1).max(25).default(8),
});

export const buildDiscoverQuery = z.object({
  make: z.string().trim().max(40).optional(),
  model: z.string().trim().max(60).optional(),
  generation: z.string().trim().max(40).optional(),
  category: z.string().trim().max(40).optional(),
  country: countryCode.optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
