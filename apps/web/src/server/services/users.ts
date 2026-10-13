import 'server-only';
import { isDuplicateKeyError, type UserDoc, type UserSettingsDoc } from '@vogn/database';
import type {
  AudienceVisibility,
  Locale,
  MeProfile,
  OnboardingState,
  PublicProfile,
  RelationshipState,
  UserSettings,
  VerificationLevel,
} from '@vogn/types';
import { defaultUnitsForCountry, isReservedHandle } from '@vogn/utils';
import { type OnboardingInput, type ProfileUpdateInput, type SettingsUpdateInput, onboardingSchema, usernameSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import { isBootstrapAdmin } from '../auth';
import { actorFromUser, type AuthedContext, type ServiceContext } from '../context';
import { AppError, conflict, notFound } from '../errors';
import type { ClerkUserInfo } from '../integrations/clerk';
import { computePublicBadges, CREW_SUMMARY_PROJECTION, iso, toCrewSummary, toMediaRef, toVehicleSummary } from '../mappers';
import { audit } from './audit';
import { releaseMedia, resolveOwnedMediaEmbed } from './media';

const USERNAME_REDIRECT_DAYS = 30;
const USERNAME_CHANGE_COOLDOWN_DAYS = 7;

export function defaultSettings(locale: Locale = 'en', country: string | null = null): UserSettings {
  const prefs = {
    directMessages: true,
    mentions: true,
    replies: true,
    reactions: true,
    crewInvitations: true,
    membership: true,
    verification: true,
    events: true,
    announcements: true,
    social: true,
    security: true,
  };
  return {
    profileVisibility: 'public',
    onlineStatusVisibility: 'crew_members',
    activityVisibility: 'members',
    garageVisibility: 'public',
    dmPrivacy: 'crew_members',
    friendRequests: 'everyone',
    showVerificationBadges: true,
    allowFollowers: true,
    locale,
    units: defaultUnitsForCountry(country),
    colorScheme: 'dark',
    reducedMotion: 'system',
    notifications: {
      inApp: { ...prefs },
      push: { ...prefs, reactions: false },
      email: { ...prefs, reactions: false, mentions: false, replies: false, directMessages: false, announcements: false, social: false },
      quietHours: { enabled: false, start: '22:00', end: '07:00', timezone: 'UTC' },
    },
  };
}

function stripSettingsDoc(doc: UserSettingsDoc | null, fallback: UserSettings): UserSettings {
  if (!doc) return fallback;
  const { _id, userId, createdAt, updatedAt, ...settings } = doc;
  void _id;
  void userId;
  void createdAt;
  void updatedAt;
  return settings;
}

export function toMeProfile(user: UserDoc, settings: UserSettings): MeProfile {
  return {
    id: user._id.toHexString(),
    clerkUserId: user.clerkUserId,
    username: user.username,
    displayName: user.displayName,
    avatar: toMediaRef(user.avatar),
    banner: toMediaRef(user.banner),
    bio: user.bio,
    country: user.country,
    language: user.language,
    pronouns: user.pronouns,
    website: user.website,
    socialLinks: user.socialLinks,
    favoriteBrands: user.favoriteBrands,
    interests: user.interests,
    featuredVehicleId: user.featuredVehicleId?.toHexString() ?? null,
    accentColor: user.accentColor,
    onboardingCompleted: user.onboardingCompleted,
    platformRole: user.platformRole,
    status: user.status,
    verificationLevels: user.verificationLevels,
    settings,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getSettings(ctx: ServiceContext, userId: ObjectId): Promise<UserSettings> {
  const doc = await ctx.cols.userSettings.findOne({ userId });
  return stripSettingsDoc(doc, defaultSettings());
}

export async function getMe(ctx: ServiceContext, clerkUserId: string, clerkInfo: () => Promise<ClerkUserInfo>): Promise<MeProfile | OnboardingState> {
  const user = await ctx.cols.users.findOne({ clerkUserId, status: { $ne: 'deleted' } });
  if (!user) {
    const info = await clerkInfo().catch(() => ({ emailVerified: false, phoneVerified: false, username: null }));
    const suggested = info.username && usernameSchema.safeParse(info.username).success ? info.username : null;
    return { needsOnboarding: true, suggestedUsername: suggested, suggestedDisplayName: null, emailVerified: info.emailVerified };
  }
  return toMeProfile(user, await getSettings(ctx, user._id));
}

/* ---------------------------------- usernames ---------------------------------- */

export async function checkUsername(
  ctx: ServiceContext,
  username: string,
  excludeUserId?: ObjectId,
): Promise<{ available: boolean; reason: string | null }> {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { available: false, reason: parsed.error.issues[0]?.message ?? 'validation.username.chars' };
  const lower = parsed.data.toLowerCase();
  if (isReservedHandle(lower)) return { available: false, reason: 'validation.username.reserved' };
  const [user, redirect] = await Promise.all([
    ctx.cols.users.findOne({ usernameLower: lower }, { projection: { _id: 1 } }),
    ctx.cols.usernameRedirects.findOne({ usernameLower: lower, expiresAt: { $gt: ctx.now } }, { projection: { userId: 1 } }),
  ]);
  if (user && !(excludeUserId && user._id.equals(excludeUserId))) return { available: false, reason: 'validation.username.taken' };
  // Recently released handles stay reserved for their previous owner to prevent impersonation via old links.
  if (redirect && !(excludeUserId && redirect.userId.equals(excludeUserId))) return { available: false, reason: 'validation.username.taken' };
  return { available: true, reason: null };
}

/* ---------------------------------- onboarding ---------------------------------- */

export async function completeOnboarding(
  ctx: ServiceContext,
  clerkUserId: string,
  rawInput: OnboardingInput,
  clerkInfo: ClerkUserInfo,
): Promise<MeProfile> {
  const input = onboardingSchema.parse(rawInput);
  const existing = await ctx.cols.users.findOne({ clerkUserId });
  if (existing && existing.status !== 'deleted') throw conflict('Profile already exists.');

  const availability = await checkUsername(ctx, input.username);
  if (!availability.available) throw new AppError('VALIDATION_FAILED', 'Username unavailable.', { fieldErrors: { username: availability.reason } });

  const platformRole = isBootstrapAdmin(clerkUserId) ? 'admin' : 'user';
  const levels: VerificationLevel[] = [];
  if (clerkInfo.emailVerified) levels.push('email_verified');
  if (clerkInfo.phoneVerified) levels.push('phone_verified');
  const settings = defaultSettings(input.language, input.country ?? null);

  const user: UserDoc = {
    _id: new ObjectId(),
    clerkUserId,
    username: input.username,
    usernameLower: input.username.toLowerCase(),
    displayName: input.displayName,
    avatar: null,
    banner: null,
    bio: null,
    country: input.country ?? null,
    language: input.language,
    pronouns: null,
    website: null,
    socialLinks: [],
    favoriteBrands: input.favoriteBrands,
    interests: input.interests,
    featuredVehicleId: null,
    accentColor: null,
    onboardingCompleted: true,
    platformRole,
    status: 'active',
    suspendedUntil: null,
    suspensionReason: null,
    verificationLevels: levels,
    publicBadges: computePublicBadges({ verificationLevels: levels, platformRole }, settings.showVerificationBadges),
    emailVerified: clerkInfo.emailVerified,
    phoneVerified: clerkInfo.phoneVerified,
    lastActiveAt: ctx.now,
    usernameChangedAt: null,
    deletionRequestedAt: null,
    deletedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };

  try {
    if (existing) {
      // Re-onboarding after a deletion keeps the Clerk link unique by replacing the tombstone.
      await ctx.cols.users.deleteOne({ _id: existing._id, status: 'deleted' });
    }
    await ctx.cols.users.insertOne(user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('VALIDATION_FAILED', 'Username unavailable.', { fieldErrors: { username: 'validation.username.taken' } });
    }
    throw error;
  }
  await ctx.cols.userSettings.insertOne({ _id: new ObjectId(), userId: user._id, ...settings, createdAt: ctx.now, updatedAt: ctx.now });
  await audit({ ...ctx, actor: actorFromUser(user) }, { action: 'account.created', targetType: 'user', targetId: user._id });
  return toMeProfile(user, settings);
}

/* ---------------------------------- profile ---------------------------------- */

export async function updateProfile(ctx: AuthedContext, input: ProfileUpdateInput): Promise<MeProfile> {
  const user = await ctx.cols.users.findOne({ _id: ctx.actor.userId });
  if (!user) throw notFound('User');
  const set: Partial<UserDoc> = { updatedAt: ctx.now };

  if (input.username !== undefined && input.username !== user.username) {
    const lowerNew = input.username.toLowerCase();
    if (lowerNew !== user.usernameLower) {
      if (user.usernameChangedAt && ctx.now.getTime() - user.usernameChangedAt.getTime() < USERNAME_CHANGE_COOLDOWN_DAYS * 86400_000) {
        throw new AppError('RATE_LIMITED', 'You can change your username once a week.', {
          fieldErrors: { username: 'validation.username.cooldown' },
        });
      }
      const availability = await checkUsername(ctx, input.username, user._id);
      if (!availability.available) {
        throw new AppError('VALIDATION_FAILED', 'Username unavailable.', { fieldErrors: { username: availability.reason } });
      }
      await ctx.cols.usernameRedirects.deleteMany({ usernameLower: lowerNew, userId: user._id });
      await ctx.cols.usernameRedirects.updateOne(
        { usernameLower: user.usernameLower },
        {
          $set: { userId: user._id, expiresAt: new Date(ctx.now.getTime() + USERNAME_REDIRECT_DAYS * 86400_000) },
          $setOnInsert: { _id: new ObjectId(), createdAt: ctx.now },
        },
        { upsert: true },
      );
      set.usernameChangedAt = ctx.now;
      set.usernameLower = lowerNew;
    }
    set.username = input.username;
  }

  if (input.displayName !== undefined) set.displayName = input.displayName;
  if (input.bio !== undefined) set.bio = input.bio ?? null;
  if (input.country !== undefined) set.country = input.country ?? null;
  if (input.language !== undefined) set.language = input.language;
  if (input.pronouns !== undefined) set.pronouns = input.pronouns ?? null;
  if (input.website !== undefined) set.website = input.website ?? null;
  if (input.socialLinks !== undefined) set.socialLinks = input.socialLinks;
  if (input.favoriteBrands !== undefined) set.favoriteBrands = input.favoriteBrands;
  if (input.interests !== undefined) set.interests = input.interests;
  if (input.accentColor !== undefined) set.accentColor = input.accentColor ?? null;

  if (input.featuredVehicleId !== undefined) {
    if (input.featuredVehicleId === null) set.featuredVehicleId = null;
    else {
      const vehicle = await ctx.cols.vehicles.findOne(
        { _id: ObjectId.createFromHexString(input.featuredVehicleId), ownerId: user._id, deletedAt: null },
        { projection: { _id: 1 } },
      );
      if (!vehicle) throw notFound('Vehicle');
      set.featuredVehicleId = vehicle._id;
    }
  }

  const avatar = await resolveOwnedMediaEmbed(ctx, input.avatarMediaId, ['avatar']);
  if (avatar !== undefined) set.avatar = avatar;
  const banner = await resolveOwnedMediaEmbed(ctx, input.bannerMediaId, ['banner']);
  if (banner !== undefined) set.banner = banner;

  try {
    await ctx.cols.users.updateOne({ _id: user._id }, { $set: set });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('VALIDATION_FAILED', 'Username unavailable.', { fieldErrors: { username: 'validation.username.taken' } });
    }
    throw error;
  }

  if (avatar !== undefined && user.avatar && !user.avatar.mediaId.equals(avatar?.mediaId ?? new ObjectId())) await releaseMedia(ctx, user.avatar);
  if (banner !== undefined && user.banner && !user.banner.mediaId.equals(banner?.mediaId ?? new ObjectId())) await releaseMedia(ctx, user.banner);
  if (set.username) await audit(ctx, { action: 'account.username_changed', targetType: 'user', targetId: user._id });

  const updated = await ctx.cols.users.findOne({ _id: user._id });
  return toMeProfile(updated!, await getSettings(ctx, user._id));
}

function deepMergeSettings(base: UserSettings, patch: SettingsUpdateInput): UserSettings {
  const next: UserSettings = { ...base, notifications: { ...base.notifications } };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || key === 'notifications') continue;
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  if (patch.notifications) {
    const n = patch.notifications;
    if (n.inApp) next.notifications.inApp = { ...base.notifications.inApp, ...n.inApp, security: true };
    if (n.push) next.notifications.push = { ...base.notifications.push, ...n.push, security: true };
    if (n.email) next.notifications.email = { ...base.notifications.email, ...n.email, security: true };
    if (n.quietHours) next.notifications.quietHours = { ...base.notifications.quietHours, ...n.quietHours };
  }
  return next;
}

export async function updateSettings(ctx: AuthedContext, input: SettingsUpdateInput): Promise<MeProfile> {
  const current = await getSettings(ctx, ctx.actor.userId);
  const next = deepMergeSettings(current, input);
  await ctx.cols.userSettings.updateOne(
    { userId: ctx.actor.userId },
    { $set: { ...next, updatedAt: ctx.now }, $setOnInsert: { _id: new ObjectId(), createdAt: ctx.now } },
    { upsert: true },
  );
  const user = await ctx.cols.users.findOne({ _id: ctx.actor.userId });
  if (!user) throw notFound('User');
  const badges = computePublicBadges(user, next.showVerificationBadges);
  if (JSON.stringify(badges) !== JSON.stringify(user.publicBadges)) {
    await ctx.cols.users.updateOne({ _id: user._id }, { $set: { publicBadges: badges, updatedAt: ctx.now } });
    user.publicBadges = badges;
  }
  const privacyKeys = ['profileVisibility', 'dmPrivacy', 'garageVisibility', 'onlineStatusVisibility', 'activityVisibility'] as const;
  if (privacyKeys.some((k) => input[k] !== undefined)) {
    await audit(ctx, { action: 'account.privacy_updated', targetType: 'user', targetId: user._id, metadata: { keys: privacyKeys.filter((k) => input[k] !== undefined) } });
  }
  return toMeProfile(user, next);
}

/** Re-derives verification levels + public badges from verification results and Clerk state. */
export async function syncVerificationLevels(ctx: ServiceContext, userId: ObjectId, clerk?: { emailVerified: boolean; phoneVerified: boolean }) {
  const user = await ctx.cols.users.findOne({ _id: userId });
  if (!user) return;
  const results = await ctx.cols.verificationResults
    .find({ userId, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: ctx.now } }] }, { projection: { level: 1 } })
    .toArray();
  const emailVerified = clerk?.emailVerified ?? user.emailVerified;
  const phoneVerified = clerk?.phoneVerified ?? user.phoneVerified;
  const levels = new Set<VerificationLevel>(results.map((r) => r.level));
  if (emailVerified) levels.add('email_verified');
  if (phoneVerified) levels.add('phone_verified');
  const settings = await getSettings(ctx, userId);
  const verificationLevels = [...levels];
  await ctx.cols.users.updateOne(
    { _id: userId },
    {
      $set: {
        verificationLevels,
        emailVerified,
        phoneVerified,
        publicBadges: computePublicBadges({ verificationLevels, platformRole: user.platformRole }, settings.showVerificationBadges),
        updatedAt: ctx.now,
      },
    },
  );
}

/* ------------------------------ relationships ------------------------------ */

export async function getRelationship(ctx: ServiceContext, viewerId: ObjectId | null, targetId: ObjectId): Promise<RelationshipState> {
  if (!viewerId) return { isSelf: false, friendStatus: 'none', following: false, followedBy: false, blocked: false };
  if (viewerId.equals(targetId)) return { isSelf: true, friendStatus: 'none', following: false, followedBy: false, blocked: false };
  const [edges, block] = await Promise.all([
    ctx.cols.userConnections
      .find({
        $or: [
          { fromUserId: viewerId, toUserId: targetId },
          { fromUserId: targetId, toUserId: viewerId },
        ],
      })
      .toArray(),
    ctx.cols.userBlocks.findOne({ blockerId: viewerId, blockedId: targetId }, { projection: { _id: 1 } }),
  ]);
  const out = edges.find((e) => e.fromUserId.equals(viewerId) && e.kind === 'friend');
  const inc = edges.find((e) => e.fromUserId.equals(targetId) && e.kind === 'friend');
  let friendStatus: RelationshipState['friendStatus'] = 'none';
  if (out?.status === 'accepted' || inc?.status === 'accepted') friendStatus = 'friends';
  else if (out?.status === 'pending') friendStatus = 'pending_outgoing';
  else if (inc?.status === 'pending') friendStatus = 'pending_incoming';
  return {
    isSelf: false,
    friendStatus,
    following: edges.some((e) => e.fromUserId.equals(viewerId) && e.kind === 'follow'),
    followedBy: edges.some((e) => e.fromUserId.equals(targetId) && e.kind === 'follow'),
    blocked: Boolean(block),
  };
}

export async function areFriends(ctx: ServiceContext, a: ObjectId, b: ObjectId): Promise<boolean> {
  return Boolean(
    await ctx.cols.userConnections.findOne(
      {
        kind: 'friend',
        status: 'accepted',
        $or: [
          { fromUserId: a, toUserId: b },
          { fromUserId: b, toUserId: a },
        ],
      },
      { projection: { _id: 1 } },
    ),
  );
}

export async function isBlockedEitherWay(ctx: ServiceContext, a: ObjectId, b: ObjectId): Promise<boolean> {
  return Boolean(
    await ctx.cols.userBlocks.findOne(
      {
        $or: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      { projection: { _id: 1 } },
    ),
  );
}

export async function sharedCrewIds(ctx: ServiceContext, a: ObjectId, b: ObjectId): Promise<ObjectId[]> {
  const mine = await ctx.cols.crewMembers.find({ userId: a, status: 'active' }, { projection: { crewId: 1 } }).toArray();
  if (!mine.length) return [];
  const shared = await ctx.cols.crewMembers
    .find({ userId: b, status: 'active', crewId: { $in: mine.map((m) => m.crewId) } }, { projection: { crewId: 1 } })
    .limit(50)
    .toArray();
  return shared.map((s) => s.crewId);
}

/** Audience check used for profiles, activity and garages. */
export async function viewerMatchesAudience(
  ctx: ServiceContext,
  audience: AudienceVisibility | 'crews',
  ownerId: ObjectId,
  viewerId: ObjectId | null,
  crewIds: ObjectId[] = [],
): Promise<boolean> {
  if (viewerId && viewerId.equals(ownerId)) return true;
  switch (audience) {
    case 'public':
      return true;
    case 'members':
      return Boolean(viewerId);
    case 'connections':
      return Boolean(viewerId) && (await areFriends(ctx, ownerId, viewerId!));
    case 'crews': {
      if (!viewerId || !crewIds.length) return false;
      return Boolean(
        await ctx.cols.crewMembers.findOne({ userId: viewerId, status: 'active', crewId: { $in: crewIds } }, { projection: { _id: 1 } }),
      );
    }
    default:
      return false;
  }
}

export async function resolveUsername(ctx: ServiceContext, username: string): Promise<UserDoc | null> {
  const lower = username.toLowerCase();
  const user = await ctx.cols.users.findOne({ usernameLower: lower, status: { $ne: 'deleted' } });
  if (user) return user;
  const redirect = await ctx.cols.usernameRedirects.findOne({ usernameLower: lower, expiresAt: { $gt: ctx.now } });
  if (!redirect) return null;
  return ctx.cols.users.findOne({ _id: redirect.userId, status: { $ne: 'deleted' } });
}

export async function getPublicProfile(ctx: ServiceContext, username: string): Promise<PublicProfile> {
  const user = await resolveUsername(ctx, username);
  if (!user || user.status === 'deleted') throw notFound('Profile');
  const viewerId = ctx.actor?.userId ?? null;
  const [settings, relationship, blockedByOwner] = await Promise.all([
    getSettings(ctx, user._id),
    getRelationship(ctx, viewerId, user._id),
    viewerId ? ctx.cols.userBlocks.findOne({ blockerId: user._id, blockedId: viewerId }, { projection: { _id: 1 } }) : null,
  ]);
  if (blockedByOwner) throw notFound('Profile');

  const full = !relationship.blocked && user.status === 'active' && (await viewerMatchesAudience(ctx, settings.profileVisibility, user._id, viewerId));
  const base = {
    id: user._id.toHexString(),
    username: user.username,
    displayName: user.displayName,
    avatar: toMediaRef(user.avatar),
    accentColor: user.accentColor,
    badges: user.publicBadges,
    joinedAt: user.createdAt.toISOString(),
    relationship,
  };

  const canMessageBase = Boolean(viewerId) && !relationship.isSelf && !relationship.blocked;
  const canMessage = canMessageBase && (await canDirectMessage(ctx, viewerId!, user._id, settings));
  const canSendFriendRequest =
    canMessageBase &&
    relationship.friendStatus === 'none' &&
    (settings.friendRequests === 'everyone' ||
      (settings.friendRequests === 'crew_members' && (await sharedCrewIds(ctx, viewerId!, user._id)).length > 0));

  if (!full) {
    return {
      ...base,
      access: 'limited',
      bio: null,
      banner: null,
      country: null,
      pronouns: null,
      website: null,
      socialLinks: [],
      favoriteBrands: [],
      interests: [],
      featuredVehicle: null,
      sharedCrews: [],
      stats: { vehicles: 0, crews: 0, friends: 0 },
      canMessage,
      canSendFriendRequest,
    };
  }

  const shared = viewerId && !relationship.isSelf ? await sharedCrewIds(ctx, viewerId, user._id) : [];
  const [sharedCrews, featured, vehicles, crews, friends] = await Promise.all([
    shared.length
      ? ctx.cols.crews.find({ _id: { $in: shared }, deletedAt: null }, { projection: CREW_SUMMARY_PROJECTION }).limit(12).toArray()
      : Promise.resolve([]),
    user.featuredVehicleId ? ctx.cols.vehicles.findOne({ _id: user.featuredVehicleId, deletedAt: null }) : Promise.resolve(null),
    ctx.cols.vehicles.countDocuments({ ownerId: user._id, deletedAt: null }),
    ctx.cols.crewMembers.countDocuments({ userId: user._id, status: 'active' }),
    ctx.cols.userConnections.countDocuments({ kind: 'friend', status: 'accepted', $or: [{ fromUserId: user._id }, { toUserId: user._id }] }),
  ]);

  let featuredVehicle = null;
  if (featured) {
    const { canViewVehicle } = await import('./vehicles');
    if (await canViewVehicle(ctx, featured)) featuredVehicle = toVehicleSummary(featured);
  }

  return {
    ...base,
    access: 'full',
    bio: user.bio,
    banner: toMediaRef(user.banner),
    country: user.country,
    pronouns: user.pronouns,
    website: user.website,
    socialLinks: user.socialLinks,
    favoriteBrands: user.favoriteBrands,
    interests: user.interests,
    featuredVehicle,
    sharedCrews: sharedCrews.map(toCrewSummary),
    stats: { vehicles, crews, friends },
    canMessage,
    canSendFriendRequest,
  };
}

/** DM permission according to the recipient's privacy setting and blocks. */
export async function canDirectMessage(ctx: ServiceContext, senderId: ObjectId, recipientId: ObjectId, recipientSettings?: UserSettings): Promise<boolean> {
  if (senderId.equals(recipientId)) return false;
  if (await isBlockedEitherWay(ctx, senderId, recipientId)) return false;
  const settings = recipientSettings ?? (await getSettings(ctx, recipientId));
  switch (settings.dmPrivacy) {
    case 'everyone':
      return true;
    case 'connections':
      return areFriends(ctx, senderId, recipientId);
    case 'crew_members':
      return (await areFriends(ctx, senderId, recipientId)) || (await sharedCrewIds(ctx, senderId, recipientId)).length > 0;
    default:
      return false;
  }
}

export { iso };
