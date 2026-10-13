import 'server-only';
import { ObjectId } from 'mongodb';
import { actorFromUser, type AuthedContext, type ServiceContext } from '../context';
import { decryptField } from '../crypto';
import { AppError, badRequest, notFound } from '../errors';
import { deleteClerkUser } from '../integrations/clerk';
import { deletePrivateObject } from '../integrations/r2';
import { log } from '../log';
import { audit } from './audit';
import { deleteMedia } from './media';
import { getSettings } from './users';

const EXPORT_MESSAGE_LIMIT = 10_000;

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptField(value);
  } catch {
    return null;
  }
}

/** Personal data export (GDPR Art. 15/20). Contains only data about / authored by the requesting user. */
export async function exportAccountData(ctx: AuthedContext): Promise<Record<string, unknown>> {
  const uid = ctx.actor.userId;
  const user = await ctx.cols.users.findOne({ _id: uid });
  if (!user) throw notFound('User');
  const [
    settings,
    vehicles,
    privateIds,
    updates,
    comments,
    likes,
    memberships,
    applications,
    connections,
    blocks,
    rsvps,
    verificationRequests,
    verificationResults,
    notifications,
    messages,
    reports,
    media,
  ] = await Promise.all([
    getSettings(ctx, uid),
    ctx.cols.vehicles.find({ ownerId: uid, deletedAt: null }).toArray(),
    ctx.cols.vehiclePrivate.find({ ownerId: uid }).toArray(),
    ctx.cols.vehicleBuildUpdates.find({ authorId: uid }).toArray(),
    ctx.cols.vehicleComments.find({ authorId: uid, deletedAt: null }).toArray(),
    ctx.cols.vehicleLikes.find({ userId: uid }).toArray(),
    ctx.cols.crewMembers.find({ userId: uid }).toArray(),
    ctx.cols.crewApplications.find({ userId: uid }).toArray(),
    ctx.cols.userConnections.find({ $or: [{ fromUserId: uid }, { toUserId: uid }] }).toArray(),
    ctx.cols.userBlocks.find({ blockerId: uid }).toArray(),
    ctx.cols.eventRSVPs.find({ userId: uid }).toArray(),
    ctx.cols.verificationRequests.find({ userId: uid }, { projection: { evidence: 0, 'challenge.code': 0 } }).toArray(),
    ctx.cols.verificationResults.find({ userId: uid }).toArray(),
    ctx.cols.notifications.find({ userId: uid }).sort({ createdAt: -1 }).limit(500).toArray(),
    ctx.cols.messages
      .find({ senderId: uid, deletedAt: null }, { projection: { conversationId: 1, content: 1, createdAt: 1, editedAt: 1, attachments: 1 } })
      .sort({ createdAt: -1 })
      .limit(EXPORT_MESSAGE_LIMIT)
      .toArray(),
    ctx.cols.reports.find({ reporterId: uid }, { projection: { targetType: 1, reason: 1, details: 1, status: 1, createdAt: 1 } }).toArray(),
    ctx.cols.mediaAssets.find({ ownerId: uid, status: 'ready' }, { projection: { url: 1, purpose: 1, mime: 1, bytes: 1, createdAt: 1 } }).toArray(),
  ]);
  await audit(ctx, { action: 'account.exported', targetType: 'user', targetId: uid });
  const { clerkUserId, ...profile } = user;
  void clerkUserId;
  return {
    format: 'vogn-export/v1',
    generatedAt: ctx.now.toISOString(),
    notes: [
      'Email address, phone number and sign-in methods are managed by our authentication provider and can be exported from your account security settings.',
      messages.length >= EXPORT_MESSAGE_LIMIT ? `Only your ${EXPORT_MESSAGE_LIMIT} most recent messages are included.` : null,
    ].filter(Boolean),
    profile,
    settings,
    vehicles,
    vehicleIdentifiers: privateIds.map((p) => ({
      vehicleId: p.vehicleId,
      countryCode: p.countryCode,
      registrationNumber: safeDecrypt(p.registrationEnc),
      vin: safeDecrypt(p.vinEnc),
    })),
    buildUpdates: updates,
    comments,
    likes,
    crewMemberships: memberships,
    crewApplications: applications,
    connections,
    blocks,
    eventRsvps: rsvps,
    verification: { requests: verificationRequests, results: verificationResults },
    notifications,
    messages,
    reports,
    media,
  };
}

/**
 * Deletes the account. Authored content in shared conversations remains for other participants but is
 * attributed to "Deleted user"; everything else is removed. Owned crews with other members must be
 * transferred first.
 */
export async function deleteAccount(ctx: AuthedContext, confirmUsername: string, reason: string | null): Promise<void> {
  const user = await ctx.cols.users.findOne({ _id: ctx.actor.userId });
  if (!user) throw notFound('User');
  if (confirmUsername.toLowerCase() !== user.usernameLower) {
    throw badRequest('Username confirmation does not match.', { confirmUsername: 'validation.confirmMismatch' });
  }
  const ownedCrews = await ctx.cols.crews.find({ ownerId: user._id, deletedAt: null }, { projection: { _id: 1, name: 1, memberCount: 1, slug: 1 } }).toArray();
  const blocking = ownedCrews.filter((c) => c.memberCount > 1);
  if (blocking.length) {
    throw new AppError('CONFLICT', 'Transfer ownership of your crews before deleting your account.', {
      crews: blocking.map((c) => ({ id: c._id.toHexString(), name: c.name, slug: c.slug })),
    });
  }
  await audit(ctx, { action: 'account.deletion_started', targetType: 'user', targetId: user._id, metadata: { hasReason: Boolean(reason) } });
  await performAccountDeletion(ctx, user.clerkUserId, { deleteFromProvider: true });
}

/**
 * Account removed at the identity provider (Clerk webhook). Crews with other members are handed to the
 * highest-ranked, longest-standing member so communities are not orphaned.
 */
export async function handleProviderDeletion(ctx: ServiceContext, clerkUserId: string): Promise<void> {
  const user = await ctx.cols.users.findOne({ clerkUserId, status: { $ne: 'deleted' } });
  if (!user) return;
  const actx = { ...ctx, actor: actorFromUser(user) } as AuthedContext;
  const owned = await ctx.cols.crews.find({ ownerId: user._id, deletedAt: null, memberCount: { $gt: 1 } }).toArray();
  for (const crew of owned) {
    const roles = await ctx.cols.crewRoles.find({ crewId: crew._id }).toArray();
    const rank = new Map(roles.map((r) => [r._id.toHexString(), r.position]));
    const members = await ctx.cols.crewMembers.find({ crewId: crew._id, status: 'active', userId: { $ne: user._id } }).toArray();
    const successor = members
      .map((m) => ({ m, score: Math.max(0, ...m.roleIds.map((r) => rank.get(r.toHexString()) ?? 0)) }))
      .sort((a, b) => b.score - a.score || a.m.joinedAt.getTime() - b.m.joinedAt.getTime())[0]?.m;
    if (!successor) continue;
    const ownerRole = roles.find((r) => r.managed === 'owner');
    await ctx.cols.crews.updateOne({ _id: crew._id }, { $set: { ownerId: successor.userId, updatedAt: ctx.now } });
    if (ownerRole) await ctx.cols.crewMembers.updateOne({ _id: successor._id }, { $addToSet: { roleIds: ownerRole._id } });
    await audit(actx, { action: 'crew.ownership_auto_transferred', targetType: 'crew', targetId: crew._id, crewId: crew._id, metadata: { to: successor.userId } });
  }
  await performAccountDeletion(actx, clerkUserId, { deleteFromProvider: false });
}

async function performAccountDeletion(ctx: AuthedContext, clerkUserId: string, options: { deleteFromProvider: boolean }): Promise<void> {
  const uid = ctx.actor.userId;
  const ownedCrews = await ctx.cols.crews.find({ ownerId: uid, deletedAt: null }, { projection: { _id: 1 } }).toArray();

  // Crews owned alone are deleted.
  if (ownedCrews.length) {
    await ctx.cols.crews.updateMany({ _id: { $in: ownedCrews.map((c) => c._id) } }, { $set: { deletedAt: ctx.now, updatedAt: ctx.now } });
  }

  // Leave crews (keeping counts accurate).
  const memberships = await ctx.cols.crewMembers.find({ userId: uid, status: 'active' }, { projection: { crewId: 1 } }).toArray();
  if (memberships.length) {
    await ctx.cols.crews.updateMany({ _id: { $in: memberships.map((m) => m.crewId) } }, { $inc: { memberCount: -1 } });
  }
  await ctx.cols.crewMembers.deleteMany({ userId: uid });

  // RSVPs (keep event counters accurate).
  const rsvps = await ctx.cols.eventRSVPs.find({ userId: uid }).toArray();
  for (const r of rsvps) {
    const inc = r.status === 'going' ? { goingCount: -1 } : r.status === 'interested' ? { interestedCount: -1 } : null;
    if (inc) await ctx.cols.events.updateOne({ _id: r.eventId }, { $inc: inc });
  }

  // Garage.
  const vehicles = await ctx.cols.vehicles.find({ ownerId: uid }, { projection: { _id: 1 } }).toArray();
  const vehicleIds = vehicles.map((v) => v._id);

  // Verification evidence in private storage.
  const verification = await ctx.cols.verificationRequests.find({ userId: uid }).toArray();
  for (const req of verification) {
    for (const ev of req.evidence) await deletePrivateObject(ev.key).catch((error: unknown) => log.warn('evidence delete failed', { error }));
  }

  // Likes / comments counters on other people's vehicles.
  const likes = await ctx.cols.vehicleLikes.find({ userId: uid }, { projection: { vehicleId: 1 } }).toArray();
  if (likes.length) await ctx.cols.vehicles.updateMany({ _id: { $in: likes.map((l) => l.vehicleId) } }, { $inc: { likeCount: -1 } });

  await Promise.all([
    ctx.cols.vehicles.deleteMany({ ownerId: uid }),
    ctx.cols.vehiclePrivate.deleteMany({ ownerId: uid }),
    ctx.cols.vehicleBuildUpdates.deleteMany({ $or: [{ authorId: uid }, { vehicleId: { $in: vehicleIds } }] }),
    ctx.cols.vehicleComments.deleteMany({ $or: [{ authorId: uid }, { vehicleId: { $in: vehicleIds } }] }),
    ctx.cols.vehicleLikes.deleteMany({ $or: [{ userId: uid }, { vehicleId: { $in: vehicleIds } }] }),
    ctx.cols.userSettings.deleteMany({ userId: uid }),
    ctx.cols.userConnections.deleteMany({ $or: [{ fromUserId: uid }, { toUserId: uid }] }),
    ctx.cols.userBlocks.deleteMany({ $or: [{ blockerId: uid }, { blockedId: uid }] }),
    ctx.cols.pushTokens.deleteMany({ userId: uid }),
    ctx.cols.notifications.deleteMany({ userId: uid }),
    ctx.cols.messageReadStates.deleteMany({ userId: uid }),
    ctx.cols.messageReactions.deleteMany({ userId: uid }),
    ctx.cols.conversationMembers.updateMany({ userId: uid }, { $set: { leftAt: ctx.now, hidden: true } }),
    ctx.cols.crewApplications.deleteMany({ userId: uid }),
    ctx.cols.eventRSVPs.deleteMany({ userId: uid }),
    ctx.cols.verificationRequests.deleteMany({ userId: uid }),
    ctx.cols.verificationResults.deleteMany({ userId: uid }),
    ctx.cols.pollVotes.deleteMany({ userId: uid }),
    ctx.cols.themeRatings.deleteMany({ userId: uid }),
    ctx.cols.usernameRedirects.deleteMany({ userId: uid }),
  ]);

  // Public media.
  const media = await ctx.cols.mediaAssets.find({ ownerId: uid, status: { $ne: 'deleted' } }, { projection: { _id: 1 } }).toArray();
  for (const m of media) await deleteMedia(ctx, m._id, { force: true }).catch(() => undefined);

  // Tombstone: keeps message attribution consistent ("Deleted user") without personal data.
  const tombstone = `deleted-${uid.toHexString()}`;
  await ctx.cols.users.updateOne(
    { _id: uid },
    {
      $set: {
        clerkUserId: `deleted:${uid.toHexString()}:${new ObjectId().toHexString()}`,
        username: tombstone,
        usernameLower: tombstone,
        displayName: 'Deleted user',
        avatar: null,
        banner: null,
        bio: null,
        country: null,
        pronouns: null,
        website: null,
        socialLinks: [],
        favoriteBrands: [],
        interests: [],
        featuredVehicleId: null,
        accentColor: null,
        verificationLevels: [],
        publicBadges: [],
        status: 'deleted',
        deletedAt: ctx.now,
        updatedAt: ctx.now,
      },
    },
  );

  await audit(ctx, { action: 'account.deleted', targetType: 'user', targetId: uid });
  if (options.deleteFromProvider) {
    await deleteClerkUser(clerkUserId).catch((error: unknown) => log.error('clerk user deletion failed', { error }));
  }
}
