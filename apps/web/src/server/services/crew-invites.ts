import 'server-only';
import { type CrewApplicationDoc, decodeCursor, encodeCursor, isDateIdCursor, isDuplicateKeyError } from '@vogn/database';
import { type CrewApplication, type CrewDetail, type CrewInvitation, type InvitePreview, realtimeChannels, VERIFICATION_LEVELS } from '@vogn/types';
import { codeFromBytes } from '@vogn/utils';
import { type ApplicationSubmitInput, applicationSubmitSchema } from '@vogn/validation';
import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { AuthedContext, ServiceContext } from '../context';
import { AppError, badRequest, conflict, forbidden, notFound } from '../errors';
import { loadUserSummaries, toCrewSummary } from '../mappers';
import { audit } from './audit';
import { getCrewAccess, requireMember, requirePermission } from './crew-access';
import { addMember, getCrewDetail, missingRequirements } from './crews';
import { notify } from './notifications';
import { publishNow } from './outbox';

const MAX_ACTIVE_INVITES = 100;

function toInvitation(doc: import('@vogn/database').CrewInvitationDoc, creator: import('@vogn/types').UserSummary | null): CrewInvitation {
  return {
    id: doc._id.toHexString(),
    code: doc.code,
    crewId: doc.crewId.toHexString(),
    createdBy: creator,
    maxUses: doc.maxUses,
    uses: doc.uses,
    expiresAt: doc.expiresAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listInvites(ctx: AuthedContext, crewId: ObjectId): Promise<CrewInvitation[]> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const manage = access.permissions.has('MANAGE_INVITES');
  const filter: Record<string, unknown> = { crewId, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: ctx.now } }] };
  if (!manage) filter.createdBy = ctx.actor.userId;
  const docs = await ctx.cols.crewInvitations.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
  const users = await loadUserSummaries(ctx.cols.users, docs.map((d) => d.createdBy));
  return docs.map((d) => toInvitation(d, users.get(d.createdBy.toHexString()) ?? null));
}

export async function createInvite(ctx: AuthedContext, crewId: ObjectId, input: { maxUses?: number | null; expiresInHours?: number | null }): Promise<CrewInvitation> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  if (!access.permissions.has('CREATE_INVITES') && !access.permissions.has('MANAGE_INVITES')) throw forbidden();
  const active = await ctx.cols.crewInvitations.countDocuments({ crewId, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: ctx.now } }] });
  if (active >= MAX_ACTIVE_INVITES) throw conflict('Too many active invitations. Revoke some first.');
  // Only managers may create never-expiring invites.
  const hours = input.expiresInHours === null && access.permissions.has('MANAGE_INVITES') ? null : (input.expiresInHours ?? 24 * 7);
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = {
      _id: new ObjectId(),
      crewId,
      code: codeFromBytes(randomBytes(10), 10),
      createdBy: ctx.actor.userId,
      maxUses: input.maxUses ?? null,
      uses: 0,
      expiresAt: hours ? new Date(ctx.now.getTime() + hours * 3600_000) : null,
      revokedAt: null,
      createdAt: ctx.now,
    };
    try {
      await ctx.cols.crewInvitations.insertOne(doc);
      await audit(ctx, { action: 'invite.created', targetType: 'invite', targetId: doc._id, crewId });
      const users = await loadUserSummaries(ctx.cols.users, [ctx.actor.userId]);
      return toInvitation(doc, users.get(ctx.actor.userId.toHexString()) ?? null);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
  throw new AppError('INTERNAL', 'Could not allocate an invite code.');
}

export async function revokeInvite(ctx: AuthedContext, crewId: ObjectId, inviteId: ObjectId): Promise<void> {
  const access = await getCrewAccess(ctx, crewId);
  requireMember(access);
  const invite = await ctx.cols.crewInvitations.findOne({ _id: inviteId, crewId });
  if (!invite) throw notFound('Invitation');
  if (!invite.createdBy.equals(ctx.actor.userId) && !access.permissions.has('MANAGE_INVITES')) throw forbidden();
  await ctx.cols.crewInvitations.updateOne({ _id: inviteId }, { $set: { revokedAt: ctx.now } });
  await audit(ctx, { action: 'invite.revoked', targetType: 'invite', targetId: inviteId, crewId });
}

async function loadValidInvite(ctx: ServiceContext, code: string) {
  const invite = await ctx.cols.crewInvitations.findOne({ code: code.toUpperCase() });
  const valid =
    !!invite && !invite.revokedAt && (!invite.expiresAt || invite.expiresAt > ctx.now) && (invite.maxUses === null || invite.uses < invite.maxUses);
  return { invite, valid };
}

/** Invite previews are public: possessing a valid code is what grants visibility of hidden crews. */
export async function previewInvite(ctx: ServiceContext, code: string): Promise<InvitePreview> {
  const { invite, valid } = await loadValidInvite(ctx, code);
  if (!invite) throw notFound('Invitation');
  const crew = await ctx.cols.crews.findOne({ _id: invite.crewId, deletedAt: null });
  if (!crew) throw notFound('Invitation');
  const [inviters, member] = await Promise.all([
    loadUserSummaries(ctx.cols.users, [invite.createdBy]),
    ctx.actor ? ctx.cols.crewMembers.findOne({ crewId: crew._id, userId: ctx.actor.userId, status: 'active' }, { projection: { _id: 1 } }) : null,
  ]);
  return {
    code: invite.code,
    crew: toCrewSummary(crew),
    inviter: inviters.get(invite.createdBy.toHexString()) ?? null,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    valid,
    alreadyMember: Boolean(member),
  };
}

export async function acceptInvite(ctx: AuthedContext, code: string): Promise<CrewDetail> {
  const { invite, valid } = await loadValidInvite(ctx, code);
  if (!invite || !valid) throw new AppError('GONE', 'This invitation is invalid or has expired.');
  const crew = await ctx.cols.crews.findOne({ _id: invite.crewId, deletedAt: null });
  if (!crew) throw notFound('Invitation');
  const missing = missingRequirements(ctx, crew, true);
  if (missing.length) throw new AppError('FORBIDDEN', 'You do not meet this crew’s requirements yet.', { missingRequirements: missing });
  // Atomically consume one use (guards against races past maxUses).
  const consumed = await ctx.cols.crewInvitations.findOneAndUpdate(
    { _id: invite._id, revokedAt: null, ...(invite.maxUses !== null ? { uses: { $lt: invite.maxUses } } : {}) },
    { $inc: { uses: 1 } },
  );
  if (!consumed) throw new AppError('GONE', 'This invitation has been used up.');
  const result = await addMember(ctx, crew, ctx.actor.userId, invite.createdBy);
  if (result === 'already') await ctx.cols.crewInvitations.updateOne({ _id: invite._id }, { $inc: { uses: -1 } });
  else {
    // An accepted invite supersedes any pending application.
    await ctx.cols.crewApplications.updateMany({ crewId: crew._id, userId: ctx.actor.userId, status: 'pending' }, { $set: { status: 'withdrawn', updatedAt: ctx.now } });
    await audit(ctx, { action: 'invite.accepted', targetType: 'invite', targetId: invite._id, crewId: crew._id });
  }
  return getCrewDetail(ctx, crew._id);
}

/* -------------------------------- applications -------------------------------- */

function toApplication(doc: CrewApplicationDoc, applicant: import('@vogn/types').UserSummary): CrewApplication {
  return {
    id: doc._id.toHexString(),
    crewId: doc.crewId.toHexString(),
    applicant,
    answers: doc.answers,
    sharedVerification: doc.sharedVerification ? { levels: doc.sharedVerification.levels, vehicleIds: doc.sharedVerification.vehicleIds.map((v) => v.toHexString()) } : null,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    reviewedAt: doc.reviewedAt?.toISOString() ?? null,
    reviewNote: doc.reviewNote,
  };
}

export async function submitApplication(ctx: AuthedContext, crewId: ObjectId, raw: ApplicationSubmitInput): Promise<CrewApplication> {
  const input = applicationSubmitSchema.parse(raw);
  const access = await getCrewAccess(ctx, crewId);
  if (!access.canView) throw notFound('Crew');
  const crew = access.crew;
  if (access.member) throw conflict('You are already a member.');
  if (access.membership?.status === 'banned') throw forbidden('You are banned from this crew.');
  if (crew.visibility !== 'application' || !crew.applicationForm?.enabled) throw forbidden('This crew does not accept applications.');
  const form = crew.applicationForm;

  const answers = form.questions.map((q) => {
    const answer = input.answers.find((a) => a.questionId === q.id);
    const value = answer?.value ?? '';
    const empty = Array.isArray(value) ? value.length === 0 : value.trim() === '';
    if (q.required && empty) throw new AppError('VALIDATION_FAILED', 'Please answer all required questions.', { fieldErrors: { [`answers.${q.id}`]: 'validation.text.min' } });
    if ((q.kind === 'single_choice' || q.kind === 'multi_choice') && !empty) {
      const values = Array.isArray(value) ? value : [value];
      if (values.some((v) => !q.options.includes(v))) throw badRequest('Invalid choice.', { [`answers.${q.id}`]: 'validation.choice' });
      if (q.kind === 'single_choice' && values.length > 1) throw badRequest('Choose one option.');
    }
    return { questionId: q.id, label: q.label, value };
  });

  // Applicants may only share verification outcomes they actually hold, for vehicles they own.
  let sharedVerification: CrewApplicationDoc['sharedVerification'] = null;
  if (input.shareVerification && form.allowVerificationShare) {
    const own = new Set(ctx.actor.verificationLevels);
    const levels = input.shareVerification.levels.filter((l) => (VERIFICATION_LEVELS as readonly string[]).includes(l) && own.has(l as never));
    const vehicleIds = input.shareVerification.vehicleIds.map((v) => ObjectId.createFromHexString(v));
    const owned = vehicleIds.length
      ? await ctx.cols.vehicles.find({ _id: { $in: vehicleIds }, ownerId: ctx.actor.userId, deletedAt: null }, { projection: { _id: 1 } }).toArray()
      : [];
    if (owned.length !== vehicleIds.length) throw forbidden('You can only share your own vehicles.');
    sharedVerification = { levels, vehicleIds };
  }

  let referralCode: string | null = null;
  if (input.referralCode) {
    const { invite, valid } = await loadValidInvite(ctx, input.referralCode);
    if (invite && valid && invite.crewId.equals(crewId)) referralCode = invite.code;
  }
  if (crew.requirements.invitationOrReferral && !referralCode) {
    throw new AppError('FORBIDDEN', 'This crew requires a referral code from a member.', { missingRequirements: ['invitationOrReferral'] });
  }

  const doc: CrewApplicationDoc = {
    _id: new ObjectId(),
    crewId,
    userId: ctx.actor.userId,
    answers,
    sharedVerification,
    consentAt: ctx.now,
    referralCode,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  try {
    await ctx.cols.crewApplications.insertOne(doc);
  } catch (error) {
    if (isDuplicateKeyError(error)) throw conflict('You already have a pending application.');
    throw error;
  }
  await audit(ctx, { action: 'application.submitted', targetType: 'application', targetId: doc._id, crewId });

  // Notify reviewers (owner + roles that can approve), capped.
  const reviewerRoleIds = access.roles.filter((r) => r.permissions.includes('APPROVE_APPLICANTS') || r.permissions.includes('ADMINISTRATOR')).map((r) => r._id);
  const reviewers = await ctx.cols.crewMembers
    .find({ crewId, status: 'active', $or: [{ roleIds: { $in: reviewerRoleIds } }, { userId: crew.ownerId }] }, { projection: { userId: 1 } })
    .limit(25)
    .toArray();
  for (const r of reviewers) {
    await notify(ctx, {
      userId: r.userId,
      type: 'application_received',
      actorId: ctx.actor.userId,
      crewId,
      title: `New application to ${crew.name}`,
      link: `/c/${crew.slug}/settings/applications`,
      groupKey: `applications:${crewId.toHexString()}`,
    });
  }
  const users = await loadUserSummaries(ctx.cols.users, [ctx.actor.userId]);
  return toApplication(doc, users.get(ctx.actor.userId.toHexString())!);
}

export async function withdrawApplication(ctx: AuthedContext, crewId: ObjectId): Promise<void> {
  const res = await ctx.cols.crewApplications.updateOne({ crewId, userId: ctx.actor.userId, status: 'pending' }, { $set: { status: 'withdrawn', updatedAt: ctx.now } });
  if (!res.matchedCount) throw notFound('Application');
}

export async function listApplications(ctx: AuthedContext, crewId: ObjectId, status: 'pending' | 'approved' | 'rejected', cursor: string | undefined, limit = 30) {
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'APPROVE_APPLICANTS');
  const filter: Record<string, unknown> = { crewId, status };
  const c = decodeCursor(cursor, isDateIdCursor);
  if (c) filter.$or = [{ createdAt: { $lt: new Date(c.t) } }, { createdAt: new Date(c.t), _id: { $lt: ObjectId.createFromHexString(c.id) } }];
  const docs = await ctx.cols.crewApplications.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
  const users = await loadUserSummaries(ctx.cols.users, docs.map((d) => d.userId));
  const items = docs.filter((d) => users.has(d.userId.toHexString())).map((d) => toApplication(d, users.get(d.userId.toHexString())!));
  const last = docs[docs.length - 1];
  return { items, nextCursor: docs.length === limit && last ? encodeCursor({ t: last.createdAt.getTime(), id: last._id.toHexString() }) : null };
}

export async function reviewApplication(
  ctx: AuthedContext,
  crewId: ObjectId,
  applicationId: ObjectId,
  input: { decision: 'approve' | 'reject'; note?: string | null },
): Promise<CrewApplication> {
  const access = await getCrewAccess(ctx, crewId);
  requirePermission(access, 'APPROVE_APPLICANTS');
  const app = await ctx.cols.crewApplications.findOneAndUpdate(
    { _id: applicationId, crewId, status: 'pending' },
    { $set: { status: input.decision === 'approve' ? 'approved' : 'rejected', reviewedBy: ctx.actor.userId, reviewedAt: ctx.now, reviewNote: input.note ?? null, updatedAt: ctx.now } },
    { returnDocument: 'after' },
  );
  if (!app) throw notFound('Application');
  if (input.decision === 'approve') {
    await addMember(ctx, access.crew, app.userId, null);
    await publishNow(ctx, [
      { channel: realtimeChannels.user(app.userId.toHexString()), name: 'crew.membership', payload: { type: 'crew.membership', crewId: crewId.toHexString(), status: 'approved' } },
    ]);
  }
  await notify(ctx, {
    userId: app.userId,
    type: input.decision === 'approve' ? 'membership_approved' : 'membership_rejected',
    actorId: null,
    crewId,
    title: input.decision === 'approve' ? `Welcome to ${access.crew.name}!` : `Your application to ${access.crew.name} was not approved`,
    body: input.note ?? null,
    link: `/c/${access.crew.slug}`,
  });
  await audit(ctx, { action: `application.${input.decision}d`, targetType: 'application', targetId: applicationId, crewId });
  const users = await loadUserSummaries(ctx.cols.users, [app.userId]);
  return toApplication(app, users.get(app.userId.toHexString())!);
}
