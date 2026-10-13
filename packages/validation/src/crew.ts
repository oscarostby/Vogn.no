import {
  APPLICATION_QUESTION_KINDS,
  CHANNEL_SCOPED_PERMISSIONS,
  CHANNEL_TYPES,
  CREW_CATEGORIES,
  CREW_MODERATION_ACTIONS,
  CREW_PERMISSIONS,
  CREW_VISIBILITIES,
} from '@vogn/types';
import { isReservedHandle } from '@vogn/utils';
import { z } from 'zod';
import {
  countryCode,
  hexColor,
  objectId,
  optionalMultiLine,
  optionalSingleLine,
  singleLine,
  tagList,
} from './common';

export const crewSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'validation.slug.min')
  .max(32, 'validation.slug.max')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'validation.slug.chars')
  .refine((s) => !isReservedHandle(s), 'validation.slug.reserved');

export const CREW_TEMPLATES = ['standard', 'build_club', 'meet_crew', 'brand_club', 'minimal'] as const;
export type CrewTemplate = (typeof CREW_TEMPLATES)[number];

export const crewRequirementsSchema = z.object({
  verifiedEmail: z.boolean().default(false),
  verifiedPhone: z.boolean().default(false),
  identityChecked: z.boolean().default(false),
  vehicleSpecsConfirmed: z.boolean().default(false),
  vehicleAccessReviewed: z.boolean().default(false),
  ownershipEvidenceReviewed: z.boolean().default(false),
  invitationOrReferral: z.boolean().default(false),
  explanation: optionalMultiLine(600).transform((v) => v ?? null),
});

const questionId = z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/);

export const applicationFormSchema = z.object({
  enabled: z.boolean(),
  intro: optionalMultiLine(1000).transform((v) => v ?? null),
  allowVerificationShare: z.boolean().default(true),
  questions: z
    .array(
      z
        .object({
          id: questionId,
          kind: z.enum(APPLICATION_QUESTION_KINDS),
          label: singleLine(1, 200),
          help: optionalSingleLine(300).transform((v) => v ?? null),
          required: z.boolean().default(false),
          options: z.array(singleLine(1, 80)).max(12).default([]),
        })
        .refine(
          (q) => !['single_choice', 'multi_choice'].includes(q.kind) || q.options.length >= 2,
          'validation.application.options',
        ),
    )
    .max(15, 'validation.tooMany'),
});

export const crewCreateSchema = z.object({
  name: singleLine(2, 50, 'validation.crewName'),
  slug: crewSlugSchema,
  description: optionalMultiLine(1000),
  category: z.enum(CREW_CATEGORIES),
  visibility: z.enum(CREW_VISIBILITIES),
  region: optionalSingleLine(60),
  country: countryCode.nullable().optional(),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'validation.language').default('en'),
  tags: tagList(10, 24).default([]),
  iconMediaId: objectId.nullable().optional(),
  bannerMediaId: objectId.nullable().optional(),
  template: z.enum(CREW_TEMPLATES).default('standard'),
  themePreset: z.string().regex(/^[a-z0-9-]{2,40}$/).default('vogn-minimal'),
});
export type CrewCreateInput = z.input<typeof crewCreateSchema>;

export const crewUpdateSchema = z.object({
  name: singleLine(2, 50, 'validation.crewName').optional(),
  slug: crewSlugSchema.optional(),
  description: optionalMultiLine(1000),
  category: z.enum(CREW_CATEGORIES).optional(),
  visibility: z.enum(CREW_VISIBILITIES).optional(),
  region: optionalSingleLine(60),
  country: countryCode.nullable().optional(),
  language: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'validation.language').optional(),
  tags: tagList(10, 24).optional(),
  iconMediaId: objectId.nullable().optional(),
  bannerMediaId: objectId.nullable().optional(),
  rules: z.array(singleLine(1, 300)).max(20, 'validation.tooMany').optional(),
  requirements: crewRequirementsSchema.optional(),
  applicationForm: applicationFormSchema.optional(),
});
export type CrewUpdateInput = z.input<typeof crewUpdateSchema>;

export const crewDiscoverQuery = z.object({
  q: z.string().trim().max(80).optional(),
  country: countryCode.optional(),
  region: z.string().trim().max(60).optional(),
  language: z.string().max(10).optional(),
  category: z.enum(CREW_CATEGORIES).optional(),
  brand: z.string().trim().max(40).optional(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  availability: z.enum(['open', 'application', 'invite']).optional(),
  sort: z.enum(['trending', 'members', 'new']).default('trending'),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export const roleBadgeSchema = z.object({
  icon: z.string().regex(/^[a-z0-9-]{2,40}$/),
  style: z.enum(['solid', 'outline', 'glow']),
});

export const roleCreateSchema = z.object({
  name: singleLine(1, 32),
  color: hexColor.nullable().optional(),
  badge: roleBadgeSchema.nullable().optional(),
  permissions: z.array(z.enum(CREW_PERMISSIONS)).max(CREW_PERMISSIONS.length).default([]),
  mentionable: z.boolean().default(false),
  hoist: z.boolean().default(false),
});
export const roleUpdateSchema = roleCreateSchema.partial();
export const roleReorderSchema = z.object({ roleIds: z.array(objectId).min(1).max(100) });

export const memberUpdateSchema = z.object({
  roleIds: z.array(objectId).max(25, 'validation.tooMany').optional(),
  nickname: optionalSingleLine(32),
  accentColor: hexColor.nullable().optional(),
});

/** Members may edit their own crew nickname / accent (if allowed) without touching their global profile. */
export const selfMemberUpdateSchema = z.object({
  nickname: optionalSingleLine(32),
  accentColor: hexColor.nullable().optional(),
});

export const crewModerationSchema = z.object({
  action: z.enum(CREW_MODERATION_ACTIONS),
  userId: objectId.optional(),
  messageId: objectId.optional(),
  channelId: objectId.optional(),
  reason: optionalSingleLine(500),
  durationMinutes: z.number().int().min(1).max(60 * 24 * 28).optional(),
  deleteRecentMessages: z.boolean().optional(),
});
export type CrewModerationInput = z.input<typeof crewModerationSchema>;

export const overwriteSchema = z.object({
  roleId: objectId,
  allow: z.array(z.enum(CHANNEL_SCOPED_PERMISSIONS)).default([]),
  deny: z.array(z.enum(CHANNEL_SCOPED_PERMISSIONS)).default([]),
});

const channelName = z
  .string()
  .trim()
  .min(1, 'validation.channelName.min')
  .max(40, 'validation.channelName.max')
  .transform((s) => s.toLowerCase().replace(/\s+/g, '-'))
  .pipe(z.string().regex(/^[\p{L}\p{N}_-]+$/u, 'validation.channelName.chars'));

export const channelCreateSchema = z.object({
  name: channelName,
  type: z.enum(CHANNEL_TYPES),
  parentId: objectId.nullable().optional(),
  topic: optionalSingleLine(300),
  icon: z.string().regex(/^[a-z0-9-]{2,40}$/).nullable().optional(),
  overwrites: z.array(overwriteSchema).max(50).optional(),
  slowmodeSeconds: z.number().int().min(0).max(21_600).optional(),
  locked: z.boolean().optional(),
});
export type ChannelCreateInput = z.input<typeof channelCreateSchema>;
export const channelUpdateSchema = channelCreateSchema.omit({ type: true }).partial();

export const channelReorderSchema = z.object({
  items: z
    .array(z.object({ id: objectId, position: z.number().int().min(0).max(10_000), parentId: objectId.nullable() }))
    .min(1)
    .max(200),
});

export const inviteCreateSchema = z.object({
  maxUses: z.number().int().min(1).max(1000).nullable().optional(),
  expiresInHours: z.number().int().min(1).max(24 * 30).nullable().optional(),
});

export const applicationSubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId,
        value: z.union([singleLine(0, 2000), z.array(singleLine(1, 80)).max(12)]),
      }),
    )
    .max(15),
  shareVerification: z
    .object({
      levels: z.array(z.string().max(40)).max(6),
      vehicleIds: z.array(objectId).max(5),
    })
    .nullable()
    .optional(),
  /** Explicit consent to share the answers (and chosen verification outcomes) with crew reviewers. */
  consent: z.literal(true, 'validation.consent'),
  referralCode: optionalSingleLine(32),
});
export type ApplicationSubmitInput = z.input<typeof applicationSubmitSchema>;

export const applicationReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: optionalSingleLine(500),
});

export const crewNotificationSettingsSchema = z.object({
  level: z.enum(['all', 'mentions', 'nothing']).optional(),
  mutedUntil: z.iso.datetime({ offset: true }).nullable().optional(),
  suppressEveryone: z.boolean().optional(),
});

export const transferOwnershipSchema = z.object({
  userId: objectId,
  confirmSlug: z.string().min(1).max(40),
});
