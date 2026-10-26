import type { Id, ISODate, MediaRef } from './common';
import type { UserSummary } from './user';

export type VehicleVisibility = 'public' | 'connections' | 'crews' | 'private';
export type Drivetrain = 'fwd' | 'rwd' | 'awd' | '4wd' | 'other';
export type Transmission = 'manual' | 'automatic' | 'dct' | 'cvt' | 'sequential' | 'other';
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'plugin_hybrid' | 'electric' | 'hydrogen' | 'other';
export type Aspiration = 'natural' | 'turbo' | 'twin_turbo' | 'supercharged' | 'electric' | 'other';

/** Built-in modification categories; users can add custom ones. */
export const BUILT_IN_MOD_CATEGORIES = [
  'engine',
  'turbo',
  'ecu',
  'exhaust',
  'suspension',
  'wheels',
  'brakes',
  'exterior',
  'interior',
  'audio',
  'lighting',
  'other',
] as const;
export type BuiltInModCategory = (typeof BUILT_IN_MOD_CATEGORIES)[number];

export interface ModificationCategory {
  id: string;
  name: string;
  builtIn: BuiltInModCategory | null;
}

export interface ModificationField {
  key: string;
  value: string;
}

export interface ModificationItem {
  id: string;
  categoryId: string;
  name: string;
  brand: string | null;
  notes: string | null;
  installedAt: ISODate | null;
  fields: ModificationField[];
}

/** Values entered by the owner. Always rendered as "owner-reported". */
export interface ClaimedSpecs {
  engine: string | null;
  displacementCc: number | null;
  aspiration: Aspiration | null;
  fuel: FuelType | null;
  originalHp: number | null;
  currentHp: number | null;
  torqueNm: number | null;
  weightKg: number | null;
}

/** Snapshot from an official registry provider. Never contains owner data. */
export interface OfficialVehicleData {
  provider: string;
  countryCode: string;
  fetchedAt: ISODate;
  make: string | null;
  model: string | null;
  variant: string | null;
  bodyType: string | null;
  color: string | null;
  fuel: string | null;
  powerKw: number | null;
  displacementCc: number | null;
  gearbox: string | null;
  drivetrain: string | null;
  firstRegistration: string | null;
  modelYear: number | null;
  seats: number | null;
  weightKg: number | null;
  engine?: string | null;
}

export interface VehicleVerificationSummary {
  specsConfirmed: boolean;
  accessReviewed: boolean;
  ownershipEvidenceReviewed: boolean;
}

export interface VehicleSummary {
  id: Id;
  ownerId: Id;
  make: string;
  model: string;
  generation: string | null;
  year: number | null;
  trim: string | null;
  nickname: string | null;
  coverImage: MediaRef | null;
  currentHp: number | null;
  visibility: VehicleVisibility;
  verification: VehicleVerificationSummary;
  likeCount: number;
  updatedAt: ISODate;
}

export interface WheelSpecs {
  front: string | null;
  rear: string | null;
  tires: string | null;
}

export interface VehicleDetail extends VehicleSummary {
  owner: UserSummary;
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
  officialData: OfficialVehicleData | null;
  gallery: MediaRef[];
  visibleCrewIds: Id[];
  likesEnabled: boolean;
  commentsEnabled: boolean;
  showExpenses: boolean;
  totalExpenses: { amount: number; currency: string } | null;
  commentCount: number;
  createdAt: ISODate;
  viewer: {
    isOwner: boolean;
    liked: boolean;
    canComment: boolean;
    /** Only present for the owner: whether private identifiers (VIN/registration) are stored. */
    hasPrivateIdentifiers?: boolean;
    registrationCountry?: string | null;
  };
}

export const BUILD_UPDATE_KINDS = [
  'update',
  'modification',
  'milestone',
  'maintenance',
  'dyno',
  'event',
  'purchase',
] as const;
export type BuildUpdateKind = (typeof BUILD_UPDATE_KINDS)[number];

export interface BuildUpdate {
  id: Id;
  vehicleId: Id;
  kind: BuildUpdateKind;
  title: string;
  body: string | null;
  occurredAt: ISODate;
  media: MediaRef[];
  before: MediaRef | null;
  after: MediaRef | null;
  cost: { amount: number; currency: string } | null;
  createdAt: ISODate;
}

export interface VehicleComment {
  id: Id;
  vehicleId: Id;
  author: UserSummary;
  body: string;
  createdAt: ISODate;
  canDelete: boolean;
}

/** Discover feed item for builds. */
export interface BuildFeedItem {
  vehicle: VehicleSummary;
  owner: UserSummary;
  latestUpdate: BuildUpdate | null;
}
