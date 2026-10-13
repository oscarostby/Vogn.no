import 'server-only';
import type { CrewDoc, MediaEmbed, UserDoc, VehicleDoc } from '@vogn/database';
import type { CrewSummary, MediaRef, PublicBadge, UserSummary, VehicleSummary } from '@vogn/types';
import type { ObjectId } from 'mongodb';

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
export const isoReq = (d: Date): string => d.toISOString();
export const hex = (id: ObjectId | null | undefined): string | null => (id ? id.toHexString() : null);

export function toMediaRef(embed: MediaEmbed | null | undefined): MediaRef | null {
  if (!embed) return null;
  return {
    id: embed.mediaId.toHexString(),
    kind: embed.kind,
    url: embed.url,
    width: embed.width,
    height: embed.height,
    mime: embed.mime,
    alt: embed.alt,
    thumbnailUrl: embed.thumbnailUrl,
  };
}

/** Minimal user projection used for summaries (keeps queries small; never includes private fields). */
export const USER_SUMMARY_PROJECTION = {
  _id: 1,
  username: 1,
  displayName: 1,
  avatar: 1,
  accentColor: 1,
  publicBadges: 1,
  status: 1,
} as const;

export type UserSummaryDoc = Pick<UserDoc, '_id' | 'username' | 'displayName' | 'avatar' | 'accentColor' | 'publicBadges' | 'status'>;

export function toUserSummary(user: UserSummaryDoc): UserSummary {
  if (user.status === 'deleted') {
    return { id: user._id.toHexString(), username: 'deleted', displayName: 'Deleted user', avatar: null, accentColor: null, badges: [] };
  }
  return {
    id: user._id.toHexString(),
    username: user.username,
    displayName: user.displayName,
    avatar: toMediaRef(user.avatar),
    accentColor: user.accentColor,
    badges: (user.publicBadges ?? []) as PublicBadge[],
  };
}

export const CREW_SUMMARY_PROJECTION = {
  _id: 1,
  slug: 1,
  name: 1,
  description: 1,
  icon: 1,
  banner: 1,
  category: 1,
  tags: 1,
  region: 1,
  country: 1,
  language: 1,
  visibility: 1,
  memberCount: 1,
  accentColor: 1,
  createdAt: 1,
} as const;

export function toCrewSummary(crew: Pick<CrewDoc, keyof typeof CREW_SUMMARY_PROJECTION>): CrewSummary {
  return {
    id: crew._id.toHexString(),
    slug: crew.slug,
    name: crew.name,
    description: crew.description,
    icon: toMediaRef(crew.icon),
    banner: toMediaRef(crew.banner),
    category: crew.category,
    tags: crew.tags,
    region: crew.region,
    country: crew.country,
    language: crew.language,
    visibility: crew.visibility,
    memberCount: crew.memberCount,
    accentColor: crew.accentColor,
    createdAt: crew.createdAt.toISOString(),
  };
}

export function toVehicleSummary(v: VehicleDoc): VehicleSummary {
  return {
    id: v._id.toHexString(),
    ownerId: v.ownerId.toHexString(),
    make: v.make,
    model: v.model,
    generation: v.generation,
    year: v.year,
    trim: v.trim,
    nickname: v.nickname,
    coverImage: toMediaRef(v.coverImage ?? v.gallery[0] ?? null),
    currentHp: v.specs.currentHp ?? v.specs.originalHp ?? null,
    visibility: v.visibility,
    verification: v.verification,
    likeCount: v.likeCount,
    updatedAt: v.updatedAt.toISOString(),
  };
}

/** Loads user summaries for a set of ids in one query (no N+1). */
export async function loadUserSummaries(
  users: import('mongodb').Collection<UserDoc>,
  ids: Iterable<ObjectId | null | undefined>,
): Promise<Map<string, UserSummary>> {
  const unique = new Map<string, ObjectId>();
  for (const id of ids) if (id) unique.set(id.toHexString(), id);
  if (!unique.size) return new Map();
  const docs = await users
    .find({ _id: { $in: [...unique.values()] } }, { projection: USER_SUMMARY_PROJECTION })
    .toArray();
  return new Map(docs.map((d) => [d._id.toHexString(), toUserSummary(d as UserSummaryDoc)]));
}

export function computePublicBadges(user: Pick<UserDoc, 'verificationLevels' | 'platformRole'>, showVerification: boolean): PublicBadge[] {
  const badges: PublicBadge[] = [];
  if (user.platformRole === 'admin' || user.platformRole === 'moderator' || user.platformRole === 'support') badges.push('staff');
  if (showVerification) badges.push(...user.verificationLevels.filter((l) => l !== 'email_verified'));
  return badges;
}
