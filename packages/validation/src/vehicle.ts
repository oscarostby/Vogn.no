import { BUILD_UPDATE_KINDS, BUILT_IN_MOD_CATEGORIES } from '@vogn/types';
import { z } from 'zod';
import {
  countryCode,
  isoDateTime,
  money,
  multiLine,
  objectId,
  optionalMultiLine,
  optionalSingleLine,
  singleLine,
} from './common';

const currentYear = new Date().getFullYear();

const nullableNumber = (min: number, max: number) =>
  z.number().min(min, 'validation.number.min').max(max, 'validation.number.max').nullable().optional();

export const claimedSpecsSchema = z.object({
  engine: optionalSingleLine(80),
  displacementCc: nullableNumber(50, 20_000),
  aspiration: z.enum(['natural', 'turbo', 'twin_turbo', 'supercharged', 'electric', 'other']).nullable().optional(),
  fuel: z
    .enum(['petrol', 'diesel', 'hybrid', 'plugin_hybrid', 'electric', 'hydrogen', 'other'])
    .nullable()
    .optional(),
  originalHp: nullableNumber(1, 5_000),
  currentHp: nullableNumber(1, 5_000),
  torqueNm: nullableNumber(1, 10_000),
  weightKg: nullableNumber(100, 20_000),
});

export const wheelSpecsSchema = z.object({
  front: optionalSingleLine(120),
  rear: optionalSingleLine(120),
  tires: optionalSingleLine(120),
});

/** Registration numbers/VINs are stored encrypted and never shown publicly. */
export const vehicleIdentifiersSchema = z.object({
  countryCode: countryCode,
  registrationNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9 -]{2,12}$/, 'validation.registration')
    .transform((s) => s.replace(/[\s-]/g, ''))
    .nullable()
    .optional(),
  vin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NPR-Z0-9]{11,17}$/, 'validation.vin')
    .nullable()
    .optional(),
});

const vehicleFields = {
  make: singleLine(1, 40, 'validation.make'),
  model: singleLine(1, 60, 'validation.model'),
  generation: optionalSingleLine(40),
  year: z.number().int().min(1886, 'validation.year').max(currentYear + 2, 'validation.year').nullable().optional(),
  trim: optionalSingleLine(60),
  nickname: optionalSingleLine(40),
  description: optionalMultiLine(4000),
  color: optionalSingleLine(40),
  drivetrain: z.enum(['fwd', 'rwd', 'awd', '4wd', 'other']).nullable().optional(),
  transmission: z.enum(['manual', 'automatic', 'dct', 'cvt', 'sequential', 'other']).nullable().optional(),
  specs: claimedSpecsSchema.partial().optional(),
  wheels: wheelSpecsSchema.partial().optional(),
  suspension: optionalMultiLine(500),
  exhaust: optionalMultiLine(500),
  ecuTuning: optionalMultiLine(500),
  turbo: optionalMultiLine(500),
  interior: optionalMultiLine(500),
  audio: optionalMultiLine(500),
  visibility: z.enum(['public', 'connections', 'crews', 'private']).optional(),
  visibleCrewIds: z.array(objectId).max(20, 'validation.tooMany').optional(),
  likesEnabled: z.boolean().optional(),
  commentsEnabled: z.boolean().optional(),
  showExpenses: z.boolean().optional(),
  coverMediaId: objectId.nullable().optional(),
};

export const vehicleCreateSchema = z.object({
  ...vehicleFields,
  identifiers: vehicleIdentifiersSchema.nullable().optional(),
});
export type VehicleCreateInput = z.input<typeof vehicleCreateSchema>;

export const vehicleUpdateSchema = z.object({
  ...vehicleFields,
  make: vehicleFields.make.optional(),
  model: vehicleFields.model.optional(),
  /** `null` removes stored identifiers. */
  identifiers: vehicleIdentifiersSchema.nullable().optional(),
});
export type VehicleUpdateInput = z.input<typeof vehicleUpdateSchema>;

const shortId = z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/, 'validation.id');

export const modificationsSchema = z
  .object({
    categories: z
      .array(
        z.object({
          id: shortId,
          name: singleLine(1, 40),
          builtIn: z.enum(BUILT_IN_MOD_CATEGORIES).nullable(),
        }),
      )
      .max(40, 'validation.tooMany'),
    modifications: z
      .array(
        z.object({
          id: shortId,
          categoryId: shortId,
          name: singleLine(1, 120),
          brand: optionalSingleLine(60).transform((v) => v ?? null),
          notes: optionalMultiLine(1000).transform((v) => v ?? null),
          installedAt: isoDateTime.nullable().optional().transform((v) => v ?? null),
          fields: z
            .array(z.object({ key: singleLine(1, 40), value: singleLine(0, 200) }))
            .max(12, 'validation.tooMany')
            .default([]),
        }),
      )
      .max(250, 'validation.tooMany'),
  })
  .refine(
    (v) => {
      const ids = new Set(v.categories.map((c) => c.id));
      return v.modifications.every((m) => ids.has(m.categoryId));
    },
    { message: 'validation.modifications.category', path: ['modifications'] },
  );
export type ModificationsInput = z.input<typeof modificationsSchema>;

export const buildUpdateCreateSchema = z.object({
  kind: z.enum(BUILD_UPDATE_KINDS),
  title: singleLine(1, 120),
  body: optionalMultiLine(4000),
  occurredAt: isoDateTime,
  mediaIds: z.array(objectId).max(10, 'validation.tooMany').default([]),
  beforeMediaId: objectId.nullable().optional(),
  afterMediaId: objectId.nullable().optional(),
  cost: money.nullable().optional(),
});
export type BuildUpdateCreateInput = z.input<typeof buildUpdateCreateSchema>;
export const buildUpdateUpdateSchema = buildUpdateCreateSchema.partial();

export const vehicleGallerySchema = z.object({
  mediaIds: z.array(objectId).max(60, 'validation.tooMany'),
});

export const vehicleCommentSchema = z.object({ body: multiLine(1, 1000) });

export const vehicleLookupSchema = z.object({
  countryCode: countryCode,
  registrationNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9 -]{2,12}$/, 'validation.registration')
    .transform((s) => s.replace(/[\s-]/g, '')),
});
