import { SOCIAL_PLATFORMS } from '@vogn/types';
import { isReservedHandle } from '@vogn/utils';
import { z } from 'zod';
import {
  countryCode,
  hexColor,
  httpsUrl,
  localeSchema,
  objectId,
  optionalMultiLine,
  optionalSingleLine,
  singleLine,
  tagList,
  timeZone,
} from './common';

/**
 * Usernames are ASCII (letters, digits, underscore, dot) to keep URLs stable and to prevent homoglyph
 * impersonation. Display names accept full Unicode.
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'validation.username.min')
  .max(24, 'validation.username.max')
  .regex(/^[A-Za-z0-9_.]+$/, 'validation.username.chars')
  .refine((u) => !/^[.]|[.]$/.test(u) && !u.includes('..'), 'validation.username.dots')
  .refine((u) => !isReservedHandle(u), 'validation.username.reserved');

export const displayNameSchema = singleLine(1, 40, 'validation.displayName');

export const AUTOMOTIVE_INTERESTS = [
  'jdm',
  'euro',
  'muscle',
  'supercars',
  'classics',
  'offroad',
  'motorsport',
  'drift',
  'track_days',
  'drag',
  'rally',
  'detailing',
  'car_audio',
  'stance',
  'restomod',
  'ev',
  'photography',
  'diy_wrenching',
  'tuning',
  'car_meets',
] as const;

export const socialLinkSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: httpsUrl,
});

export const onboardingSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  country: countryCode.nullable().optional(),
  language: localeSchema.default('en'),
  interests: z.array(z.enum(AUTOMOTIVE_INTERESTS)).max(20).default([]),
  favoriteBrands: tagList(20, 40).default([]),
  acceptTerms: z.literal(true, 'validation.acceptTerms'),
});
export type OnboardingInput = z.input<typeof onboardingSchema>;

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  displayName: displayNameSchema.optional(),
  bio: optionalMultiLine(500, 'validation.bio'),
  country: countryCode.nullable().optional(),
  language: localeSchema.optional(),
  pronouns: optionalSingleLine(30),
  website: httpsUrl.nullable().optional(),
  socialLinks: z.array(socialLinkSchema).max(8, 'validation.tooMany').optional(),
  favoriteBrands: tagList(20, 40).optional(),
  interests: z.array(z.enum(AUTOMOTIVE_INTERESTS)).max(20).optional(),
  featuredVehicleId: objectId.nullable().optional(),
  accentColor: hexColor.nullable().optional(),
  avatarMediaId: objectId.nullable().optional(),
  bannerMediaId: objectId.nullable().optional(),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

const audience = z.enum(['public', 'members', 'connections', 'private']);
const prefSwitches = z.object({
  directMessages: z.boolean(),
  mentions: z.boolean(),
  replies: z.boolean(),
  reactions: z.boolean(),
  crewInvitations: z.boolean(),
  membership: z.boolean(),
  verification: z.boolean(),
  events: z.boolean(),
  announcements: z.boolean(),
  social: z.boolean(),
  security: z.literal(true).optional(), // security alerts cannot be disabled in-app
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.time');

export const settingsUpdateSchema = z.object({
  profileVisibility: audience.optional(),
  onlineStatusVisibility: z.enum(['everyone', 'connections', 'crew_members', 'nobody']).optional(),
  activityVisibility: audience.optional(),
  garageVisibility: z.enum(['public', 'connections', 'crews', 'private']).optional(),
  dmPrivacy: z.enum(['everyone', 'connections', 'crew_members', 'nobody']).optional(),
  friendRequests: z.enum(['everyone', 'crew_members', 'nobody']).optional(),
  showVerificationBadges: z.boolean().optional(),
  allowFollowers: z.boolean().optional(),
  locale: localeSchema.optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  colorScheme: z.enum(['dark', 'light', 'system']).optional(),
  reducedMotion: z.enum(['system', 'reduce', 'no-preference']).optional(),
  notifications: z
    .object({
      inApp: prefSwitches.partial().optional(),
      push: prefSwitches.partial().optional(),
      email: prefSwitches.partial().optional(),
      quietHours: z
        .object({ enabled: z.boolean(), start: hhmm, end: hhmm, timezone: timeZone })
        .partial()
        .optional(),
    })
    .optional(),
});
export type SettingsUpdateInput = z.input<typeof settingsUpdateSchema>;

export const usernameAvailabilityQuery = z.object({ username: z.string().min(1).max(40) });

export const accountDeletionSchema = z.object({
  confirmUsername: z.string().min(1).max(40),
  reason: optionalSingleLine(500),
});

export const blockUserSchema = z.object({ userId: objectId });
export const connectionActionSchema = z.object({
  action: z.enum(['request', 'accept', 'decline', 'cancel', 'remove', 'follow', 'unfollow']),
});
