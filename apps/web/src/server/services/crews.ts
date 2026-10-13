import 'server-only';
import {
  type ConversationDoc,
  type CrewChannelDoc,
  type CrewDoc,
  type CrewMemberDoc,
  type CrewRoleDoc,
  decodeCursor,
  encodeCursor,
  isDuplicateKeyError,
  isNumberIdCursor,
  runTransaction,
} from '@vogn/database';
import { DEFAULT_ROLE_TEMPLATES } from '@vogn/permissions';
import { presetManifest } from '@vogn/theme-engine';
import type { ChannelScopedPermission, ChannelType, CrewDetail, CrewRequirements, CrewSummary, CrewViewerState, ManagedRole } from '@vogn/types';
import { type CrewCreateInput, type CrewTemplate, type CrewUpdateInput, crewCreateSchema, crewDiscoverQuery, crewUpdateSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import type { z } from 'zod';
import type { AuthedContext, ServiceContext, Session } from '../context';
import { AppError, badRequest, conflict, forbidden, notFound } from '../errors';
import { CREW_SUMMARY_PROJECTION, toCrewSummary } from '../mappers';
import { audit } from './audit';
import { type CrewAccess, getCrewAccess, getVisibleCrewAccess, requireMember, requirePermission } from './crew-access';
import { EMPTY_REQUIREMENTS, toCrewDetail } from './crew-mappers';
import { releaseMedia, resolveOwnedMediaEmbed } from './media';
import { notify } from './notifications';
import { publishNow } from './outbox';

const MAX_OWNED_CREWS = 10;
const SLUG_REDIRECT_DAYS = 60;

interface ChannelSpec {
  name: string;
  type: ChannelType;
  topic?: string;
  icon?: string;
  readOnly?: boolean;
}

interface CategorySpec {
  name: string;
  channels: ChannelSpec[];
}

const TEMPLATES: Record<CrewTemplate, CategorySpec[]> = {
  standard: [
    {
      name: 'Info',
      channels: [
        { name: 'announcements', type: 'announcement', topic: 'Official news from the crew team', icon: 'megaphone', readOnly: true },
        { name: 'rules', type: 'text', topic: 'Read before posting', icon: 'shield', readOnly: true },
      ],
    },
    {
      name: 'Community',
      channels: [
        { name: 'general', type: 'text', topic: 'Say hi and introduce your car' },
        { name: 'builds', type: 'showcase', topic: 'Progress, before & after', icon: 'wrench' },
        { name: 'meets', type: 'event', topic: 'Plans, meet points and convoys', icon: 'map-pin' },
        { name: 'media', type: 'media', topic: 'Photos and videos', icon: 'camera' },
      ],
    },
    { name: 'Voice', channels: [{ name: 'garage-talk', type: 'voice', icon: 'mic' }] },
  ],
  build_club: [
    {
      name: 'Info',
      channels: [{ name: 'announcements', type: 'announcement', topic: 'Club news', icon: 'megaphone', readOnly: true }],
    },
    {
      name: 'Workshop',
      channels: [
        { name: 'general', type: 'text', topic: 'Shop talk' },
        { name: 'build-logs', type: 'showcase', topic: 'One thread per build', icon: 'wrench' },
        { name: 'tech-help', type: 'forum', topic: 'Ask the hive mind', icon: 'cog' },
        { name: 'parts-swap', type: 'text', topic: 'Trade parts with members (no commercial selling)', icon: 'store' },
      ],
    },
    { name: 'Voice', channels: [{ name: 'workshop', type: 'voice', icon: 'mic' }] },
  ],
  meet_crew: [
    {
      name: 'Info',
      channels: [{ name: 'announcements', type: 'announcement', topic: 'Meet announcements', icon: 'megaphone', readOnly: true }],
    },
    {
      name: 'Meets',
      channels: [
        { name: 'general', type: 'text', topic: 'Chat between meets' },
        { name: 'meets', type: 'event', topic: 'Upcoming meets', icon: 'calendar' },
        { name: 'route-planning', type: 'forum', topic: 'Drives and convoys', icon: 'route' },
        { name: 'photos', type: 'media', topic: 'Meet photography', icon: 'camera' },
      ],
    },
    { name: 'Voice', channels: [{ name: 'convoy-radio', type: 'voice', icon: 'mic' }] },
  ],
  brand_club: [
    {
      name: 'Info',
      channels: [{ name: 'announcements', type: 'announcement', topic: 'Club news', icon: 'megaphone', readOnly: true }],
    },
    {
      name: 'Club',
      channels: [
        { name: 'general', type: 'text', topic: 'All things marque' },
        { name: 'tech-talk', type: 'forum', topic: 'Model-specific know-how', icon: 'cog' },
        { name: 'builds', type: 'showcase', topic: 'Member cars', icon: 'car-front' },
        { name: 'meets', type: 'event', topic: 'Club events', icon: 'calendar' },
      ],
    },
    { name: 'Voice', channels: [{ name: 'lounge', type: 'voice', icon: 'mic' }] },
  ],
  minimal: [
    {
      name: 'Text',
      channels: [
        { name: 'announcements', type: 'announcement', icon: 'megaphone', readOnly: true },
        { name: 'general', type: 'text' },
      ],
    },
  ],
};

/* ----------------------------------- create ---------------------------------- */

export async function createCrew(ctx: AuthedContext, raw: CrewCreateInput): Promise<CrewDetail> {
  const input = crewCreateSchema.parse(raw);
  const owned = await ctx.cols.crews.countDocuments({ ownerId: ctx.actor.userId, deletedAt: null });
  if (owned >= MAX_OWNED_CREWS) throw conflict(`You can own up to ${MAX_OWNED_CREWS} crews.`);
  if (await ctx.cols.crewSlugRedirects.findOne({ slug: input.slug, expiresAt: { $gt: ctx.now } })) {
    throw new AppError('VALIDATION_FAILED', 'Slug unavailable.', { fieldErrors: { slug: 'validation.slug.taken' } });
  }
  const icon = await resolveOwnedMediaEmbed(ctx, input.iconMediaId, ['crew_icon']);
  const banner = await resolveOwnedMediaEmbed(ctx, input.bannerMediaId, ['crew_banner']);
  const manifest = presetManifest(input.themePreset);
  const crewId = new ObjectId();
  const now = ctx.now;

  const roles: CrewRoleDoc[] = DEFAULT_ROLE_TEMPLATES.map((tpl) => ({
    _id: new ObjectId(),
    crewId,
    name: tpl.name,
    color: tpl.color,
    badge: tpl.key === 'owner' ? { icon: 'crown', style: 'solid' } : tpl.key === 'verified' ? { icon: 'shield-check', style: 'outline' } : null,
    position: tpl.position,
    permissions: tpl.permissions,
    managed: tpl.key,
    mentionable: tpl.key === 'moderator',
    hoist: tpl.hoist,
    isDefault: tpl.isDefault,
    createdAt: now,
    updatedAt: now,
  }));
  const roleBy = (key: ManagedRole) => roles.find((r) => r.managed === key)!;
  const defaultRole = roleBy('member');

  const crew: CrewDoc = {
    _id: crewId,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    icon: icon ?? null,
    banner: banner ?? null,
    category: input.category,
    tags: input.tags,
    region: input.region ?? null,
    country: input.country ?? null,
    language: input.language,
    visibility: input.visibility,
    ownerId: ctx.actor.userId,
    memberCount: 1,
    activityScore: 0,
    rules: ['Be respectful. No harassment, hate or doxxing.', 'Keep it legal — no street racing or reckless driving content.', 'Ask before sharing photos of other people or their plates.'],
    requirements: { ...EMPTY_REQUIREMENTS },
    applicationForm:
      input.visibility === 'application'
        ? {
            enabled: true,
            intro: null,
            allowVerificationShare: true,
            questions: [
              { id: 'car', kind: 'vehicle', label: 'Which car do you drive?', help: null, required: false, options: [] },
              { id: 'why', kind: 'long_text', label: 'Why do you want to join?', help: null, required: true, options: [] },
              { id: 'found', kind: 'short_text', label: 'How did you hear about the crew?', help: null, required: false, options: [] },
            ],
          }
        : null,
    defaultRoleId: defaultRole._id,
    accentColor: manifest.colors.primary,
    publishedThemeVersion: 1,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const channels: CrewChannelDoc[] = [];
  const conversations: ConversationDoc[] = [];
  let position = 0;
  for (const category of TEMPLATES[input.template]) {
    const categoryId = new ObjectId();
    channels.push(channelDoc(crewId, categoryId, category.name, 'category', null, position++, null, null, []));
    for (const spec of category.channels) {
      const channelId = new ObjectId();
      const conversationId = spec.type === 'voice' ? null : new ObjectId();
      const overwrites = spec.readOnly
        ? [
            { roleId: defaultRole._id, allow: [] as ChannelScopedPermission[], deny: ['SEND_MESSAGES'] as ChannelScopedPermission[] },
            { roleId: roleBy('moderator')._id, allow: ['SEND_MESSAGES'] as ChannelScopedPermission[], deny: [] as ChannelScopedPermission[] },
          ]
        : [];
      channels.push(channelDoc(crewId, channelId, spec.name, spec.type, categoryId, position++, spec.topic ?? null, spec.icon ?? null, overwrites, conversationId));
      if (conversationId) conversations.push(conversationDoc(conversationId, crewId, channelId, now));
    }
  }

  const member: CrewMemberDoc = {
    _id: new ObjectId(),
    crewId,
    userId: ctx.actor.userId,
    roleIds: [roleBy('owner')._id],
    nickname: null,
    accentColor: null,
    status: 'active',
    timeoutUntil: null,
    invitedBy: null,
    joinedAt: now,
    notificationLevel: 'all',
    mutedUntil: null,
    suppressEveryone: false,
    banReason: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await runTransaction(
      ctx.client,
      async (session) => {
        await ctx.cols.crews.insertOne(crew, { session });
        await ctx.cols.crewRoles.insertMany(roles, { session });
        await ctx.cols.crewMembers.insertOne(member, { session });
        await ctx.cols.crewChannels.insertMany(channels, { session });
        if (conversations.length) await ctx.cols.conversations.insertMany(conversations, { session });
        await ctx.cols.crewThemes.insertOne(
          {
            _id: new ObjectId(),
            crewId,
            draft: manifest as unknown as Record<string, unknown>,
            draftUpdatedAt: now,
            draftUpdatedBy: ctx.actor.userId,
            published: manifest as unknown as Record<string, unknown>,
            publishedVersion: 1,
            publishedAt: now,
            createdAt: now,
          },
          { session },
        );
        await ctx.cols.crewThemeVersions.insertOne(
          {
            _id: new ObjectId(),
            crewId,
            version: 1,
            manifest: manifest as unknown as Record<string, unknown>,
            note: `Created from ${manifest.meta.name}`,
            publishedBy: ctx.actor.userId,
            publishedAt: now,
            restoredFrom: null,
          },
          { session },
        );
        await audit(ctx, { action: 'crew.created', targetType: 'crew', targetId: crewId, crewId }, session);
      },
      { enabled: ctx.transactions },
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError('VALIDATION_FAILED', 'Slug unavailable.', { fieldErrors: { slug: 'validation.slug.taken' } });
    }
    throw error;
  }
  return getCrewDetail(ctx, crew._id);
}

function channelDoc(
  crewId: ObjectId,
  id: ObjectId,
  name: string,
  type: ChannelType,
  parentId: ObjectId | null,
  position: number,
  topic: string | null,
  icon: string | null,
  overwrites: CrewChannelDoc['overwrites'],
  conversationId: ObjectId | null = null,
): CrewChannelDoc {
  const now = new Date();
  return { _id: id, crewId, conversationId, name, type, parentId, position, topic, icon, locked: false, slowmodeSeconds: 0, overwrites, deletedAt: null, createdAt: now, updatedAt: now };
}

export function conversationDoc(id: ObjectId, crewId: ObjectId, channelId: ObjectId, now: Date): ConversationDoc {
  return {
    _id: id,
    kind: 'channel',
    crewId,
    channelId,
    dmKey: null,
    name: null,
    createdBy: null,
    parentConversationId: null,
    rootMessageId: null,
    memberCount: 0,
    messageSeq: 0,
    lastMessageAt: null,
    lastMessageId: null,
    lastMessagePreview: null,
    createdAt: now,
    updatedAt: now,
  };
}

/* ----------------------------------- read ----------------------------------- */

type RequirementKey = keyof Omit<CrewRequirements, 'explanation'>;

export function missingRequirements(ctx: ServiceContext, crew: CrewDoc, viaInvite: boolean): RequirementKey[] {
  const actor = ctx.actor;
  const r = crew.requirements;
  const levels = new Set(actor?.verificationLevels ?? []);
  const missing: RequirementKey[] = [];
  if (r.verifiedEmail && !actor?.emailVerified) missing.push('verifiedEmail');
  if (r.verifiedPhone && !actor?.phoneVerified) missing.push('verifiedPhone');
  if (r.identityChecked && !levels.has('identity_checked')) missing.push('identityChecked');
  if (r.vehicleSpecsConfirmed && !levels.has('vehicle_specs_confirmed')) missing.push('vehicleSpecsConfirmed');
  if (r.vehicleAccessReviewed && !levels.has('vehicle_access_reviewed')) missing.push('vehicleAccessReviewed');
  if (r.ownershipEvidenceReviewed && !levels.has('ownership_evidence_reviewed')) missing.push('ownershipEvidenceReviewed');
  if (r.invitationOrReferral && !viaInvite) missing.push('invitationOrReferral');
  return missing;
}

export async function viewerState(ctx: ServiceContext, access: CrewAccess): Promise<CrewViewerState> {
  const { crew, membership, member } = access;
  const banned = membership?.status === 'banned';
  let pending = false;
  if (ctx.actor && !member && !banned) {
    pending = Boolean(
      await ctx.cols.crewApplications.findOne({ crewId: crew._id, userId: ctx.actor.userId, status: 'pending' }, { projection: { _id: 1 } }),
    );
  }
  const missing = ctx.actor ? missingRequirements(ctx, crew, false) : [];
  const timedOut = Boolean(member?.timeoutUntil && member.timeoutUntil > ctx.now);
  return {
    status: banned ? 'banned' : member ? (timedOut ? 'timed_out' : 'member') : pending ? 'pending_application' : 'none',
    isOwner: access.isOwner,
    permissions: [...access.permissions],
    roleIds: member?.roleIds.map((r) => r.toHexString()) ?? [],
    nickname: member?.nickname ?? null,
    timeoutUntil: timedOut ? member!.timeoutUntil!.toISOString() : null,
    canJoinDirectly: Boolean(ctx.actor) && !banned && !member && crew.visibility === 'public' && missing.length === 0,
    canApply: Boolean(ctx.actor) && !banned && !member && !pending && crew.visibility === 'application' && Boolean(crew.applicationForm?.enabled),
    missingRequirements: missing,
  };
}

export async function getCrewDetail(ctx: ServiceContext, crewId: ObjectId): Promise<CrewDetail> {
  const access = await getVisibleCrewAccess(ctx, crewId);
  return toCrewDetail(access.crew, await viewerState(ctx, access));
}

export async function resolveCrewSlug(ctx: ServiceContext, slug: string): Promise<CrewDoc> {
  const lower = slug.toLowerCase();
  const crew = await ctx.cols.crews.findOne({ slug: lower, deletedAt: null });
  if (crew) return crew;
  const redirect = await ctx.cols.crewSlugRedirects.findOne({ slug: lower, expiresAt: { $gt: ctx.now } });
  if (redirect) {
    const target = await ctx.cols.crews.findOne({ _id: redirect.crewId, deletedAt: null });
    if (target) return target;
  }
  throw notFound('Crew');
}

export async function getCrewBySlug(ctx: ServiceContext, slug: string): Promise<CrewDetail> {
  const crew = await resolveCrewSlug(ctx, slug);
  const access = await getVisibleCrewAccess(ctx, crew);
  return toCrewDetail(access.crew, await viewerState(ctx, access));
}

/* ---------------------------------- update ---------------------------------- */

export async function updateCrew(ctx: AuthedContext, crewId: ObjectId, raw: CrewUpdateInput): Promise<CrewDetail> {
  const input = crewUpdateSchema.parse(raw);
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const touchesVerification = input.requirements !== undefined || input.applicationForm !== undefined;
  const touchesGeneral = Object.keys(input).some((k) => !['requirements', 'applicationForm'].includes(k));
  if (touchesGeneral) requirePermission(access, 'MANAGE_CREW');
  if (touchesVerification && !access.permissions.has('MANAGE_VERIFICATION') && !access.permissions.has('MANAGE_CREW')) throw forbidden();

  const crew = access.crew;
  const set: Partial<CrewDoc> = { updatedAt: ctx.now };
  if (input.name !== undefined) set.name = input.name;
  if (input.description !== undefined) set.description = input.description ?? null;
  if (input.category !== undefined) set.category = input.category;
  if (input.region !== undefined) set.region = input.region ?? null;
  if (input.country !== undefined) set.country = input.country ?? null;
  if (input.language !== undefined) set.language = input.language;
  if (input.tags !== undefined) set.tags = input.tags;
  if (input.rules !== undefined) set.rules = input.rules;
  if (input.requirements !== undefined) set.requirements = input.requirements;
  if (input.applicationForm !== undefined) set.applicationForm = input.applicationForm;
  if (input.visibility !== undefined) {
    if (input.visibility !== crew.visibility && !access.isOwner) throw forbidden('Only the owner can change crew visibility.');
    set.visibility = input.visibility;
  }
  const icon = await resolveOwnedMediaEmbed(ctx, input.iconMediaId, ['crew_icon'], crewId);
  if (icon !== undefined) set.icon = icon;
  const banner = await resolveOwnedMediaEmbed(ctx, input.bannerMediaId, ['crew_banner'], crewId);
  if (banner !== undefined) set.banner = banner;

  if (input.slug && input.slug !== crew.slug) {
    if (!access.isOwner) throw forbidden('Only the owner can change the crew URL.');
    const taken = await ctx.cols.crewSlugRedirects.findOne({ slug: input.slug, crewId: { $ne: crewId }, expiresAt: { $gt: ctx.now } });
    if (taken) throw new AppError('VALIDATION_FAILED', 'Slug unavailable.', { fieldErrors: { slug: 'validation.slug.taken' } });
    set.slug = input.slug;
  }

  try {
    await ctx.cols.crews.updateOne({ _id: crewId }, { $set: set });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AppError('VALIDATION_FAILED', 'Slug unavailable.', { fieldErrors: { slug: 'validation.slug.taken' } });
    throw error;
  }
  if (set.slug) {
    await ctx.cols.crewSlugRedirects.deleteMany({ slug: set.slug });
    await ctx.cols.crewSlugRedirects.updateOne(
      { slug: crew.slug },
      { $set: { crewId, expiresAt: new Date(ctx.now.getTime() + SLUG_REDIRECT_DAYS * 86400_000) }, $setOnInsert: { _id: new ObjectId(), createdAt: ctx.now } },
      { upsert: true },
    );
  }
  if (icon !== undefined && crew.icon && (!icon || !icon.mediaId.equals(crew.icon.mediaId))) await releaseMedia(ctx, crew.icon);
  if (banner !== undefined && crew.banner && (!banner || !banner.mediaId.equals(crew.banner.mediaId))) await releaseMedia(ctx, crew.banner);
  await audit(ctx, { action: 'crew.updated', targetType: 'crew', targetId: crewId, crewId, metadata: { fields: Object.keys(input) } });
  return getCrewDetail(ctx, crewId);
}

export async function deleteCrew(ctx: AuthedContext, crewId: ObjectId, confirmSlug: string): Promise<void> {
  const access = await getCrewAccess(ctx, crewId);
  if (!access.isOwner) throw access.canView ? forbidden('Only the owner can delete the crew.') : notFound('Crew');
  if (confirmSlug.toLowerCase() !== access.crew.slug) throw badRequest('Confirmation does not match.', { confirmSlug: 'validation.confirmMismatch' });
  await ctx.cols.crews.updateOne({ _id: crewId }, { $set: { deletedAt: ctx.now, updatedAt: ctx.now } });
  await ctx.cols.crewInvitations.updateMany({ crewId, revokedAt: null }, { $set: { revokedAt: ctx.now } });
  await audit(ctx, { action: 'crew.deleted', targetType: 'crew', targetId: crewId, crewId });
}

/* ------------------------------ join & leave ------------------------------ */

export async function addMember(
  ctx: AuthedContext,
  crew: CrewDoc,
  userId: ObjectId,
  invitedBy: ObjectId | null,
  session?: Session,
): Promise<'joined' | 'already'> {
  const existing = await ctx.cols.crewMembers.findOne({ crewId: crew._id, userId }, { session });
  if (existing?.status === 'active') return 'already';
  if (existing?.status === 'banned') throw forbidden('You are banned from this crew.');
  const verifiedRole = await ctx.cols.crewRoles.findOne({ crewId: crew._id, managed: 'verified' }, { session });
  const user = await ctx.cols.users.findOne({ _id: userId }, { projection: { verificationLevels: 1 }, session });
  const hasVerifiedLevel = (user?.verificationLevels ?? []).some((l) => l !== 'email_verified' && l !== 'phone_verified');
  const roleIds = verifiedRole && hasVerifiedLevel ? [verifiedRole._id] : [];
  await ctx.cols.crewMembers.updateOne(
    { crewId: crew._id, userId },
    {
      $set: { status: 'active', roleIds, timeoutUntil: null, invitedBy, joinedAt: ctx.now, updatedAt: ctx.now, banReason: null },
      $setOnInsert: {
        _id: new ObjectId(),
        nickname: null,
        accentColor: null,
        notificationLevel: 'mentions',
        mutedUntil: null,
        suppressEveryone: false,
        createdAt: ctx.now,
      },
    },
    { upsert: true, session },
  );
  await ctx.cols.crews.updateOne({ _id: crew._id }, { $inc: { memberCount: 1, activityScore: 5 } }, { session });
  return 'joined';
}

export async function joinCrew(ctx: AuthedContext, crewId: ObjectId): Promise<CrewDetail> {
  const access = await getVisibleCrewAccess(ctx, crewId);
  const crew = access.crew;
  if (access.member) return getCrewDetail(ctx, crewId);
  if (access.membership?.status === 'banned') throw forbidden('You are banned from this crew.');
  if (crew.visibility !== 'public') throw forbidden('This crew requires an invitation or an approved application.');
  const missing = missingRequirements(ctx, crew, false);
  if (missing.length) throw new AppError('FORBIDDEN', 'You do not meet this crew’s requirements yet.', { missingRequirements: missing });
  await addMember(ctx, crew, ctx.actor.userId, null);
  await publishNow(ctx, [
    { channel: `user:${ctx.actor.userId.toHexString()}`, name: 'crew.membership', payload: { type: 'crew.membership', crewId: crewId.toHexString(), status: 'joined' } },
  ]);
  await audit(ctx, { action: 'crew.joined', targetType: 'crew', targetId: crewId, crewId });
  return getCrewDetail(ctx, crewId);
}

export async function leaveCrew(ctx: AuthedContext, crewId: ObjectId): Promise<void> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  if (access.isOwner) throw conflict('Transfer ownership before leaving your crew.');
  await ctx.cols.crewMembers.updateOne({ _id: access.member._id }, { $set: { status: 'left', roleIds: [], updatedAt: ctx.now } });
  await ctx.cols.crews.updateOne({ _id: crewId, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
  await audit(ctx, { action: 'crew.left', targetType: 'crew', targetId: crewId, crewId });
}

export async function transferOwnership(ctx: AuthedContext, crewId: ObjectId, targetUserId: ObjectId, confirmSlug: string): Promise<CrewDetail> {
  const access = await getCrewAccess(ctx, crewId);
  if (!access.isOwner) throw forbidden('Only the owner can transfer ownership.');
  if (confirmSlug.toLowerCase() !== access.crew.slug) throw badRequest('Confirmation does not match.', { confirmSlug: 'validation.confirmMismatch' });
  const target = await ctx.cols.crewMembers.findOne({ crewId, userId: targetUserId, status: 'active' });
  if (!target) throw notFound('Member');
  const ownerRole = access.roles.find((r) => r.managed === 'owner');
  const adminRole = access.roles.find((r) => r.managed === 'administrator');
  await runTransaction(
    ctx.client,
    async (session) => {
      await ctx.cols.crews.updateOne({ _id: crewId }, { $set: { ownerId: targetUserId, updatedAt: ctx.now } }, { session });
      if (ownerRole) {
        await ctx.cols.crewMembers.updateOne({ _id: target._id }, { $addToSet: { roleIds: ownerRole._id } }, { session });
        await ctx.cols.crewMembers.updateOne(
          { _id: access.member!._id },
          { $pull: { roleIds: ownerRole._id }, ...(adminRole ? {} : {}) },
          { session },
        );
        if (adminRole) await ctx.cols.crewMembers.updateOne({ _id: access.member!._id }, { $addToSet: { roleIds: adminRole._id } }, { session });
      }
      await audit(ctx, { action: 'crew.ownership_transferred', targetType: 'user', targetId: targetUserId, crewId }, session);
    },
    { enabled: ctx.transactions },
  );
  await notify(ctx, {
    userId: targetUserId,
    type: 'moderator_announcement',
    actorId: ctx.actor.userId,
    crewId,
    title: `You are now the owner of ${access.crew.name}`,
    link: `/c/${access.crew.slug}`,
  });
  return getCrewDetail(ctx, crewId);
}

export async function updateSelfMembership(
  ctx: AuthedContext,
  crewId: ObjectId,
  input: { nickname?: string | null; accentColor?: string | null },
): Promise<void> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const set: Record<string, unknown> = { updatedAt: ctx.now };
  if (input.nickname !== undefined) set.nickname = input.nickname ?? null;
  if (input.accentColor !== undefined) set.accentColor = input.accentColor ?? null;
  await ctx.cols.crewMembers.updateOne({ _id: access.member._id }, { $set: set });
}

export async function updateCrewNotificationSettings(
  ctx: AuthedContext,
  crewId: ObjectId,
  input: { level?: 'all' | 'mentions' | 'nothing'; mutedUntil?: string | null; suppressEveryone?: boolean },
): Promise<void> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const set: Record<string, unknown> = { updatedAt: ctx.now };
  if (input.level) set.notificationLevel = input.level;
  if (input.mutedUntil !== undefined) set.mutedUntil = input.mutedUntil ? new Date(input.mutedUntil) : null;
  if (input.suppressEveryone !== undefined) set.suppressEveryone = input.suppressEveryone;
  await ctx.cols.crewMembers.updateOne({ _id: access.member._id }, { $set: set });
}

/* --------------------------------- discovery --------------------------------- */

const SIZE_RANGES = { small: { $lt: 50 }, medium: { $gte: 50, $lt: 500 }, large: { $gte: 500 } } as const;

export async function discoverCrews(ctx: ServiceContext, raw: z.input<typeof crewDiscoverQuery>): Promise<{ items: CrewSummary[]; nextCursor: string | null }> {
  const q = crewDiscoverQuery.parse(raw);
  const filter: Record<string, unknown> = { deletedAt: null, visibility: { $in: ['public', 'application', 'invite_only'] } };
  if (q.availability === 'open') filter.visibility = 'public';
  if (q.availability === 'application') filter.visibility = 'application';
  if (q.availability === 'invite') filter.visibility = 'invite_only';
  if (q.country) filter.country = q.country;
  if (q.category) filter.category = q.category;
  if (q.language) filter.language = q.language;
  if (q.region) filter.region = { $regex: `^${escapeRegex(q.region)}`, $options: 'i' };
  if (q.size) filter.memberCount = SIZE_RANGES[q.size];
  if (q.brand) filter.tags = q.brand.toLowerCase();

  if (q.q) {
    // Text search ranks by relevance; no cursor pagination (top 50).
    const docs = await ctx.cols.crews
      .find({ ...filter, $text: { $search: q.q } }, { projection: { ...CREW_SUMMARY_PROJECTION, score: { $meta: 'textScore' } } })
      .sort({ score: { $meta: 'textScore' } })
      .limit(Math.min(q.limit, 50))
      .toArray();
    return { items: docs.map(toCrewSummary), nextCursor: null };
  }

  const sortField = q.sort === 'members' ? 'memberCount' : q.sort === 'new' ? 'createdAt' : 'activityScore';
  if (sortField === 'createdAt') {
    const c = decodeCursor(q.cursor, (r): r is { t: number; id: string } => typeof r.t === 'number' && typeof r.id === 'string');
    if (c) filter.$or = [{ createdAt: { $lt: new Date(c.t) } }, { createdAt: new Date(c.t), _id: { $lt: ObjectId.createFromHexString(c.id) } }];
    const docs = await ctx.cols.crews.find(filter, { projection: CREW_SUMMARY_PROJECTION }).sort({ createdAt: -1, _id: -1 }).limit(q.limit).toArray();
    const last = docs[docs.length - 1];
    return { items: docs.map(toCrewSummary), nextCursor: docs.length === q.limit && last ? encodeCursor({ t: last.createdAt.getTime(), id: last._id.toHexString() }) : null };
  }
  const c = decodeCursor(q.cursor, isNumberIdCursor);
  if (c) filter.$or = [{ [sortField]: { $lt: c.n } }, { [sortField]: c.n, _id: { $lt: ObjectId.createFromHexString(c.id) } }];
  const docs = await ctx.cols.crews
    .find(filter, { projection: { ...CREW_SUMMARY_PROJECTION, activityScore: 1 } })
    .sort({ [sortField]: -1, _id: -1 })
    .limit(q.limit)
    .toArray();
  const last = docs[docs.length - 1] as (CrewDoc & { activityScore: number }) | undefined;
  return {
    items: docs.map(toCrewSummary),
    nextCursor: docs.length === q.limit && last ? encodeCursor({ n: sortField === 'memberCount' ? last.memberCount : last.activityScore, id: last._id.toHexString() }) : null,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function slugAvailable(ctx: ServiceContext, slug: string): Promise<boolean> {
  const [crew, redirect] = await Promise.all([
    ctx.cols.crews.findOne({ slug: slug.toLowerCase() }, { projection: { _id: 1 } }),
    ctx.cols.crewSlugRedirects.findOne({ slug: slug.toLowerCase(), expiresAt: { $gt: ctx.now } }, { projection: { _id: 1 } }),
  ]);
  return !crew && !redirect;
}
