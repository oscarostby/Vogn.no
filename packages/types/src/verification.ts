import type { Id, ISODate } from './common';
import type { UserSummary } from './user';

/**
 * Verification levels. Labels are deliberately precise: none of them claim legal ownership or
 * government certification unless the underlying provider actually supports that classification.
 */
export const VERIFICATION_LEVELS = [
  'email_verified',
  'phone_verified',
  'identity_checked',
  'vehicle_specs_confirmed',
  'vehicle_access_reviewed',
  'ownership_evidence_reviewed',
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export interface VerificationLevelInfo {
  label: string;
  proves: string;
  doesNotProve: string;
}

export const VERIFICATION_LEVEL_INFO: Record<VerificationLevel, VerificationLevelInfo> = {
  email_verified: {
    label: 'Email verified',
    proves: 'The account controls the email address it registered with.',
    doesNotProve: 'Anything about the person’s identity or vehicles.',
  },
  phone_verified: {
    label: 'Phone verified',
    proves: 'The account confirmed a one-time code sent to a phone number.',
    doesNotProve: 'Who the phone number belongs to. The number is never shown publicly.',
  },
  identity_checked: {
    label: 'Identity checked',
    proves: 'A supported identity provider confirmed selected identity attributes for this account.',
    doesNotProve:
      'This is not a government certification unless the provider states so. No identity details are shown publicly.',
  },
  vehicle_specs_confirmed: {
    label: 'Vehicle specifications confirmed',
    proves: 'Official technical data for the supplied registration number/VIN matches the listed make and model.',
    doesNotProve: 'Ownership or possession of the vehicle. Owner-entered tuning figures remain owner claims.',
  },
  vehicle_access_reviewed: {
    label: 'Vehicle access reviewed',
    proves: 'A reviewer saw a time-limited challenge photo showing the vehicle and a one-time code.',
    doesNotProve: 'Legal ownership. It only indicates probable physical access at that time.',
  },
  ownership_evidence_reviewed: {
    label: 'Ownership evidence reviewed',
    proves: 'A reviewer examined redacted ownership documents supplied voluntarily by the user.',
    doesNotProve: 'This is a manual review, not an automated confirmation from an official ownership registry.',
  },
};

export const VERIFICATION_KINDS = ['vehicle_specs', 'vehicle_access', 'ownership_evidence', 'identity'] as const;
export type VerificationKind = (typeof VERIFICATION_KINDS)[number];

export const VERIFICATION_KIND_LEVEL: Record<VerificationKind, VerificationLevel> = {
  vehicle_specs: 'vehicle_specs_confirmed',
  vehicle_access: 'vehicle_access_reviewed',
  ownership_evidence: 'ownership_evidence_reviewed',
  identity: 'identity_checked',
};

export type VerificationStatus =
  | 'awaiting_evidence'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface VerificationChallenge {
  code: string;
  expiresAt: ISODate;
  instructions: string;
}

export interface VerificationRequestDto {
  id: Id;
  kind: VerificationKind;
  status: VerificationStatus;
  vehicleId: Id | null;
  vehicleLabel: string | null;
  countryCode: string | null;
  provider: string | null;
  challenge: VerificationChallenge | null;
  evidenceCount: number;
  decisionReason: string | null;
  createdAt: ISODate;
  submittedAt: ISODate | null;
  decidedAt: ISODate | null;
  evidenceDeletedAt: ISODate | null;
}

/** What a reviewer sees. Evidence is accessed through short-lived signed URLs only. */
export interface VerificationReviewItem extends VerificationRequestDto {
  user: UserSummary;
  evidence: { id: string; mime: string; size: number; uploadedAt: ISODate }[];
  vehicle: { make: string; model: string; year: number | null; color: string | null } | null;
}

export interface VerificationResultDto {
  id: Id;
  level: VerificationLevel;
  vehicleId: Id | null;
  provider: string;
  method: string;
  decidedAt: ISODate;
  expiresAt: ISODate | null;
}

export interface VehicleProviderInfo {
  countryCode: string;
  provider: string;
  displayName: string;
  supports: ('technical_lookup' | 'specs_verification' | 'ownership')[];
  configured: boolean;
  limitations: string;
  termsUrl: string | null;
}
