import type { ChatMessage, CrewChannel, CrewDetail, CrewInvitation, CrewRole, MessageSyncResult, RealtimeTokenResponse } from '@vogn/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as applicationsRoute from '@/app/api/v1/crews/id/[crewId]/applications/route';
import * as reviewRoute from '@/app/api/v1/crews/id/[crewId]/applications/[applicationId]/review/route';
import * as channelsRoute from '@/app/api/v1/crews/id/[crewId]/channels/route';
import * as channelRoute from '@/app/api/v1/crews/id/[crewId]/channels/[channelId]/route';
import * as crewIdRoute from '@/app/api/v1/crews/id/[crewId]/route';
import * as invitesRoute from '@/app/api/v1/crews/id/[crewId]/invites/route';
import * as joinRoute from '@/app/api/v1/crews/id/[crewId]/join/route';
import * as memberRoute from '@/app/api/v1/crews/id/[crewId]/members/[userId]/route';
import * as moderationRoute from '@/app/api/v1/crews/id/[crewId]/moderation/route';
import * as rolesRoute from '@/app/api/v1/crews/id/[crewId]/roles/route';
import * as roleRoute from '@/app/api/v1/crews/id/[crewId]/roles/[roleId]/route';
import * as crewSlugRoute from '@/app/api/v1/crews/[slug]/route';
import * as crewsRoute from '@/app/api/v1/crews/route';
import * as conversationsRoute from '@/app/api/v1/conversations/route';
import * as messagesRoute from '@/app/api/v1/conversations/[id]/messages/route';
import * as messageRoute from '@/app/api/v1/conversations/[id]/messages/[messageId]/route';
import * as reactionsRoute from '@/app/api/v1/conversations/[id]/messages/[messageId]/reactions/route';
import * as readRoute from '@/app/api/v1/conversations/[id]/read/route';
import * as syncRoute from '@/app/api/v1/conversations/[id]/sync/route';
import * as invitePublicRoute from '@/app/api/v1/invites/[code]/route';
import * as settingsRoute from '@/app/api/v1/me/settings/route';
import * as tokenRoute from '@/app/api/v1/realtime/token/route';
import * as blockRoute from '@/app/api/v1/users/id/[id]/block/route';
import { getDatabase } from '@/server/db';
import { createContext } from '@/server/context';
import { setPublisherForTests } from '@/server/integrations/ably';
import { processDueOutbox } from '@/server/services/outbox';
import { call, createUser, type Harness, startHarness } from '@/test/harness';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h?.stop();
});

let key = 0;
const idem = () => `test-key-${Date.now()}-${key++}`;

async function makeCrew(ownerClerk: string, visibility: 'public' | 'application' | 'invite_only' | 'hidden' = 'public') {
  const slug = `crew-${Math.random().toString(36).slice(2, 8)}`;
  const res = await call<CrewDetail>(crewsRoute.POST, {
    as: ownerClerk,
    body: { name: 'Night Shift', slug, category: 'jdm', visibility, template: 'standard', themePreset: 'tokyo-midnight' },
  });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.data;
}

async function channels(clerk: string, crewId: string) {
  const res = await call<CrewChannel[]>(channelsRoute.GET, { as: clerk, params: { crewId } });
  return res;
}

describe('crews', () => {
  it('creates a crew with roles, template channels and theme', async () => {
    const owner = await createUser();
    const crew = await makeCrew(owner.clerkId);
    expect(crew.viewer.isOwner).toBe(true);
    expect(crew.viewer.permissions).toContain('MANAGE_CREW');
    const list = await channels(owner.clerkId, crew.id);
    const names = list.data.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['general', 'announcements', 'builds', 'garage-talk']));
    const theme = await h.db.db.collection('crewThemes').findOne({});
    expect(theme?.publishedVersion).toBe(1);
  });

  it('lets a second user join a public crew and see channels', async () => {
    const owner = await createUser();
    const member = await createUser();
    const crew = await makeCrew(owner.clerkId);
    expect((await channels(member.clerkId, crew.id)).status).toBe(403);
    const joined = await call<CrewDetail>(joinRoute.POST, { as: member.clerkId, params: { crewId: crew.id }, body: {} });
    expect(joined.data.viewer.status).toBe('member');
    expect(joined.data.memberCount).toBe(2);
    const list = await channels(member.clerkId, crew.id);
    const announcements = list.data.find((c) => c.name === 'announcements')!;
    expect(announcements.viewer.canSend).toBe(false);
    expect(list.data.find((c) => c.name === 'general')!.viewer.canSend).toBe(true);
  });

  it('hides hidden crews and blocks joining private crews without invites', async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const hidden = await makeCrew(owner.clerkId, 'hidden');
    expect((await call(crewSlugRoute.GET, { as: outsider.clerkId, params: { slug: hidden.slug } })).status).toBe(404);
    expect((await call(crewIdRoute.GET, { as: outsider.clerkId, params: { crewId: hidden.id } })).status).toBe(404);
    expect((await call(joinRoute.POST, { as: outsider.clerkId, params: { crewId: hidden.id }, body: {} })).status).toBe(404);
    const generalOfHidden = (await channels(owner.clerkId, hidden.id)).data.find((c) => c.name === 'general')!;
    // Knowing a conversation id grants nothing.
    const peek = await call(messagesRoute.GET, { as: outsider.clerkId, params: { id: generalOfHidden.conversationId! } });
    expect(peek.status).toBe(404);
    const post = await call(messagesRoute.POST, { as: outsider.clerkId, params: { id: generalOfHidden.conversationId! }, body: { content: 'hi', idempotencyKey: idem() } });
    expect(post.status).toBe(404);

    const inviteOnly = await makeCrew(owner.clerkId, 'invite_only');
    expect((await call(joinRoute.POST, { as: outsider.clerkId, params: { crewId: inviteOnly.id }, body: {} })).status).toBe(403);
  });

  it('invitations grant access and respect max uses', async () => {
    const owner = await createUser();
    const a = await createUser();
    const b = await createUser();
    const crew = await makeCrew(owner.clerkId, 'hidden');
    const invite = await call<CrewInvitation>(invitesRoute.POST, { as: owner.clerkId, params: { crewId: crew.id }, body: { maxUses: 1, expiresInHours: 24 } });
    const preview = await call<{ valid: boolean; crew: { name: string } }>(invitePublicRoute.GET, { params: { code: invite.data.code } });
    expect(preview.data.valid).toBe(true);
    const accepted = await call<CrewDetail>(invitePublicRoute.POST, { as: a.clerkId, params: { code: invite.data.code } });
    expect(accepted.data.viewer.status).toBe('member');
    const second = await call(invitePublicRoute.POST, { as: b.clerkId, params: { code: invite.data.code } });
    expect(second.status).toBe(410);
  });

  it('applications: submit with consent, moderators approve, applicant joins', async () => {
    const owner = await createUser();
    const applicant = await createUser();
    const crew = await makeCrew(owner.clerkId, 'application');
    const noConsent = await call(applicationsRoute.POST, { as: applicant.clerkId, params: { crewId: crew.id }, body: { answers: [{ questionId: 'why', value: 'I love night runs' }] } });
    expect(noConsent.status).toBe(422);
    const missingRequired = await call(applicationsRoute.POST, { as: applicant.clerkId, params: { crewId: crew.id }, body: { answers: [], consent: true } });
    expect(missingRequired.status).toBe(422);
    const app = await call<{ id: string; status: string }>(applicationsRoute.POST, {
      as: applicant.clerkId,
      params: { crewId: crew.id },
      body: { answers: [{ questionId: 'why', value: 'I love night runs' }], consent: true, shareVerification: { levels: ['identity_checked'], vehicleIds: [] } },
    });
    expect(app.status).toBe(201);
    // Cannot share levels the applicant does not have.
    const stored = await h.db.db.collection('crewApplications').findOne({});
    expect(stored?.sharedVerification?.levels).toEqual([]);
    // Applicants cannot review.
    expect((await call(reviewRoute.POST, { as: applicant.clerkId, params: { crewId: crew.id, applicationId: app.data.id }, body: { decision: 'approve' } })).status).toBe(403);
    const reviewed = await call<{ status: string }>(reviewRoute.POST, { as: owner.clerkId, params: { crewId: crew.id, applicationId: app.data.id }, body: { decision: 'approve' } });
    expect(reviewed.data.status).toBe('approved');
    expect((await channels(applicant.clerkId, crew.id)).status).toBe(200);
  });

  it('enforces role hierarchy and permission changes', async () => {
    const owner = await createUser();
    const mod = await createUser();
    const member = await createUser();
    const crew = await makeCrew(owner.clerkId);
    await call(joinRoute.POST, { as: mod.clerkId, params: { crewId: crew.id }, body: {} });
    await call(joinRoute.POST, { as: member.clerkId, params: { crewId: crew.id }, body: {} });
    const roles = (await call<CrewRole[]>(rolesRoute.GET, { as: owner.clerkId, params: { crewId: crew.id } })).data;
    const modRole = roles.find((r) => r.managed === 'moderator')!;
    const adminRole = roles.find((r) => r.managed === 'administrator')!;
    const ownerRole = roles.find((r) => r.managed === 'owner')!;
    const everyone = roles.find((r) => r.isDefault)!;

    // Members cannot assign roles.
    expect((await call(memberRoute.PATCH, { method: 'PATCH', as: member.clerkId, params: { crewId: crew.id, userId: member.id }, body: { roleIds: [adminRole.id] } })).status).toBe(403);
    // Owner makes `mod` a moderator.
    expect((await call(memberRoute.PATCH, { method: 'PATCH', as: owner.clerkId, params: { crewId: crew.id, userId: mod.id }, body: { roleIds: [modRole.id] } })).status).toBe(200);
    // Moderators can't escalate themselves to administrator or touch the owner.
    expect((await call(memberRoute.PATCH, { method: 'PATCH', as: mod.clerkId, params: { crewId: crew.id, userId: mod.id }, body: { roleIds: [modRole.id, adminRole.id] } })).status).toBe(403);
    expect((await call(moderationRoute.POST, { as: mod.clerkId, params: { crewId: crew.id }, body: { action: 'kick', userId: owner.id } })).status).toBe(403);
    expect((await call(memberRoute.PATCH, { method: 'PATCH', as: owner.clerkId, params: { crewId: crew.id, userId: mod.id }, body: { roleIds: [ownerRole.id] } })).status).toBe(403);
    // Moderators can time out regular members.
    expect((await call(moderationRoute.POST, { as: mod.clerkId, params: { crewId: crew.id }, body: { action: 'timeout', userId: member.id, durationMinutes: 10 } })).status).toBe(200);
    const general = (await channels(member.clerkId, crew.id)).data.find((c) => c.name === 'general')!;
    expect(general.viewer.canSend).toBe(false);

    // Owner removes SEND_MESSAGES from @everyone → members can no longer post (after timeout removal).
    await call(moderationRoute.POST, { as: owner.clerkId, params: { crewId: crew.id }, body: { action: 'remove_timeout', userId: member.id } });
    await call(roleRoute.PATCH, { method: 'PATCH', as: owner.clerkId, params: { crewId: crew.id, roleId: everyone.id }, body: { permissions: ['VIEW_CHANNEL', 'ADD_REACTIONS'] } });
    const send = await call(messagesRoute.POST, { as: member.clerkId, params: { id: general.conversationId! }, body: { content: 'can I post?', idempotencyKey: idem() } });
    expect(send.status).toBe(403);
    // Moderators can't grant permissions they don't hold.
    expect((await call(roleRoute.PATCH, { method: 'PATCH', as: mod.clerkId, params: { crewId: crew.id, roleId: everyone.id }, body: { permissions: ['VIEW_CHANNEL', 'MANAGE_CREW'] } })).status).toBe(403);
  });

  it('private channel overwrites hide channels from regular members', async () => {
    const owner = await createUser();
    const member = await createUser();
    const crew = await makeCrew(owner.clerkId);
    await call(joinRoute.POST, { as: member.clerkId, params: { crewId: crew.id }, body: {} });
    const roles = (await call<CrewRole[]>(rolesRoute.GET, { as: owner.clerkId, params: { crewId: crew.id } })).data;
    const everyone = roles.find((r) => r.isDefault)!;
    const created = await call<CrewChannel>(channelsRoute.POST, {
      as: owner.clerkId,
      params: { crewId: crew.id },
      body: { name: 'staff-room', type: 'text', overwrites: [{ roleId: everyone.id, deny: ['VIEW_CHANNEL'] }] },
    });
    expect(created.status).toBe(201);
    expect((await channels(member.clerkId, crew.id)).data.some((c) => c.name === 'staff-room')).toBe(false);
    const read = await call(messagesRoute.GET, { as: member.clerkId, params: { id: created.data.conversationId! } });
    expect(read.status).toBe(404);
    // Members can't create or edit channels.
    expect((await call(channelsRoute.POST, { as: member.clerkId, params: { crewId: crew.id }, body: { name: 'x', type: 'text' } })).status).toBe(403);
    expect((await call(channelRoute.DELETE, { method: 'DELETE', as: member.clerkId, params: { crewId: crew.id, channelId: created.data.id } })).status).toBe(403);
  });
});

describe('messaging', () => {
  it('two users exchange messages; history survives "refresh"; idempotent retries', async () => {
    const owner = await createUser();
    const friend = await createUser();
    const crew = await makeCrew(owner.clerkId);
    await call(joinRoute.POST, { as: friend.clerkId, params: { crewId: crew.id }, body: {} });
    const general = (await channels(owner.clerkId, crew.id)).data.find((c) => c.name === 'general')!;
    const conv = general.conversationId!;
    h.events.length = 0;

    const key1 = idem();
    const m1 = await call<ChatMessage>(messagesRoute.POST, { as: owner.clerkId, params: { id: conv }, body: { content: `Hello <@${friend.id}>!`, idempotencyKey: key1 } });
    expect(m1.status).toBe(201);
    expect(m1.data.seq).toBe(1);
    expect(m1.data.mentions.userIds).toEqual([friend.id]);
    // Retry with the same key returns the same message, no duplicate.
    const retry = await call<ChatMessage>(messagesRoute.POST, { as: owner.clerkId, params: { id: conv }, body: { content: `Hello <@${friend.id}>!`, idempotencyKey: key1 } });
    expect(retry.data.id).toBe(m1.data.id);
    const m2 = await call<ChatMessage>(messagesRoute.POST, { as: friend.clerkId, params: { id: conv }, body: { content: 'Hey!', idempotencyKey: idem(), replyToId: m1.data.id } });
    expect(m2.data.seq).toBe(2);
    expect(m2.data.replyTo?.id).toBe(m1.data.id);

    // Realtime events were published through the outbox to the conversation channel.
    const created = h.events.filter((e) => e.name === 'message.created' && e.channel === `conv:${conv}`);
    expect(created).toHaveLength(2);

    // "Refresh": history from MongoDB.
    const history = await call<ChatMessage[]>(messagesRoute.GET, { as: friend.clerkId, params: { id: conv } });
    expect(history.data.map((m) => m.content)).toEqual([`Hello <@${friend.id}>!`, 'Hey!']);

    // Mention notification created for the friend.
    const notif = await h.db.db.collection('notifications').findOne({ type: 'mention' });
    expect(notif).toBeTruthy();
  });

  it('reconnect reconciliation recovers missed messages and edits', async () => {
    const owner = await createUser();
    const friend = await createUser();
    const crew = await makeCrew(owner.clerkId);
    await call(joinRoute.POST, { as: friend.clerkId, params: { crewId: crew.id }, body: {} });
    const conv = (await channels(owner.clerkId, crew.id)).data.find((c) => c.name === 'general')!.conversationId!;
    const first = await call<ChatMessage>(messagesRoute.POST, { as: owner.clerkId, params: { id: conv }, body: { content: 'one', idempotencyKey: idem() } });
    const since = new Date().toISOString();
    // Friend goes offline; meanwhile a message arrives and the first one is edited.
    await new Promise((r) => setTimeout(r, 5));
    await call(messagesRoute.POST, { as: owner.clerkId, params: { id: conv }, body: { content: 'two', idempotencyKey: idem() } });
    await call(messageRoute.PATCH, { method: 'PATCH', as: owner.clerkId, params: { id: conv, messageId: first.data.id }, body: { content: 'one (edited)' } });
    const sync = await call<MessageSyncResult>(syncRoute.GET, { as: friend.clerkId, params: { id: conv }, query: { afterSeq: 1, updatedSince: since } });
    expect(sync.data.messages.map((m) => m.content)).toEqual(['two']);
    expect(sync.data.updated.map((m) => m.content)).toEqual(['one (edited)']);
    expect(sync.data.lastSeq).toBe(2);
  });

  it('keeps messages when realtime delivery fails and retries via the outbox', async () => {
    const owner = await createUser();
    const crew = await makeCrew(owner.clerkId);
    const conv = (await channels(owner.clerkId, crew.id)).data.find((c) => c.name === 'general')!.conversationId!;
    h.failPublishes.value = true;
    const sent = await call<ChatMessage>(messagesRoute.POST, { as: owner.clerkId, params: { id: conv }, body: { content: 'during outage', idempotencyKey: idem() } });
    expect(sent.status).toBe(201);
    const pending = await h.db.db.collection('messageOutbox').countDocuments({ status: 'pending' });
    expect(pending).toBeGreaterThan(0);
    h.failPublishes.value = false;
    await h.db.db.collection('messageOutbox').updateMany({ status: 'pending' }, { $set: { nextAttemptAt: new Date(0) } });
    const result = await processDueOutbox(createContext(await getDatabase(), null));
    expect(result.delivered).toBeGreaterThan(0);
    expect(await h.db.db.collection('messageOutbox').countDocuments({ status: 'pending' })).toBe(0);
  });

  it('only authors edit; moderators can delete; reactions are tracked per user', async () => {
    const owner = await createUser();
    const member = await createUser();
    const crew = await makeCrew(owner.clerkId);
    await call(joinRoute.POST, { as: member.clerkId, params: { crewId: crew.id }, body: {} });
    const conv = (await channels(owner.clerkId, crew.id)).data.find((c) => c.name === 'general')!.conversationId!;
    const msg = await call<ChatMessage>(messagesRoute.POST, { as: member.clerkId, params: { id: conv }, body: { content: 'my message', idempotencyKey: idem() } });
    expect((await call(messageRoute.PATCH, { method: 'PATCH', as: owner.clerkId, params: { id: conv, messageId: msg.data.id }, body: { content: 'hijack' } })).status).toBe(403);
    const r1 = await call<ChatMessage>(reactionsRoute.POST, { as: owner.clerkId, params: { id: conv, messageId: msg.data.id }, body: { emoji: '🔥' } });
    expect(r1.data.reactions).toEqual([{ emoji: '🔥', count: 1, me: true }]);
    await call(reactionsRoute.POST, { as: owner.clerkId, params: { id: conv, messageId: msg.data.id }, body: { emoji: '🔥' } });
    const r2 = await call<ChatMessage>(reactionsRoute.POST, { as: member.clerkId, params: { id: conv, messageId: msg.data.id }, body: { emoji: '🔥' } });
    expect(r2.data.reactions[0]!.count).toBe(2);
    expect((await call(reactionsRoute.POST, { as: member.clerkId, params: { id: conv, messageId: msg.data.id }, body: { emoji: '<b>' } })).status).toBe(422);
    const del = await call<ChatMessage>(messageRoute.DELETE, { method: 'DELETE', as: owner.clerkId, params: { id: conv, messageId: msg.data.id } });
    expect(del.data.deletedAt).toBeTruthy();
    expect(del.data.content).toBe('');
  });

  it('marks conversations as read', async () => {
    const owner = await createUser();
    const crew = await makeCrew(owner.clerkId);
    const conv = (await channels(owner.clerkId, crew.id)).data.find((c) => c.name === 'general')!.conversationId!;
    await call(messagesRoute.POST, { as: owner.clerkId, params: { id: conv }, body: { content: 'x', idempotencyKey: idem() } });
    const read = await call<{ lastReadSeq: number }>(readRoute.POST, { as: owner.clerkId, params: { id: conv }, body: { seq: 99 } });
    expect(read.data.lastReadSeq).toBe(1);
  });

  it('DMs respect privacy settings and blocks', async () => {
    const a = await createUser();
    const b = await createUser();
    // Default dmPrivacy is crew_members → strangers cannot DM.
    expect((await call(conversationsRoute.POST, { as: a.clerkId, body: { userIds: [b.id] } })).status).toBe(403);
    await call(settingsRoute.PATCH, { method: 'PATCH', as: b.clerkId, body: { dmPrivacy: 'everyone' } });
    const dm = await call<{ id: string; kind: string }>(conversationsRoute.POST, { as: a.clerkId, body: { userIds: [b.id] } });
    expect(dm.status).toBe(201);
    expect(dm.data.kind).toBe('dm');
    const again = await call<{ id: string }>(conversationsRoute.POST, { as: b.clerkId, body: { userIds: [a.id] } });
    expect(again.status).toBe(403); // a has default privacy; b is not in a crew with a
    const sent = await call(messagesRoute.POST, { as: b.clerkId, params: { id: dm.data.id }, body: { content: 'hi a', idempotencyKey: idem() } });
    expect(sent.status).toBe(201);
    // A third user cannot read the DM.
    const c = await createUser();
    expect((await call(messagesRoute.GET, { as: c.clerkId, params: { id: dm.data.id } })).status).toBe(404);
    // After a block, sending fails.
    await call(blockRoute.POST, { as: a.clerkId, params: { id: b.id } });
    expect((await call(messagesRoute.POST, { as: b.clerkId, params: { id: dm.data.id }, body: { content: 'still there?', idempotencyKey: idem() } })).status).toBe(403);
  });

  it('realtime tokens are scoped to channels the user may access', async () => {
    setPublisherForTests(null);
    process.env.ABLY_API_KEY = 'appid.keyid:testsecret0123456789';
    const { overrideEnvForTests } = await import('@/server/env');
    overrideEnvForTests({ ABLY_API_KEY: 'appid.keyid:testsecret0123456789' });
    try {
      const owner = await createUser();
      const outsider = await createUser();
      const crew = await makeCrew(owner.clerkId, 'hidden');
      const conv = (await channels(owner.clerkId, crew.id)).data.find((c) => c.name === 'general')!.conversationId!;
      const ownerToken = await call<RealtimeTokenResponse>(tokenRoute.POST, { as: owner.clerkId, body: { conversationIds: [conv], crewIds: [crew.id] } });
      expect(ownerToken.data.configured).toBe(true);
      expect(ownerToken.data.channels).toEqual(expect.arrayContaining([`conv:${conv}`, `conv:${conv}:typing`, `crew:${crew.id}:presence`]));
      const capability = JSON.parse(String(ownerToken.data.tokenRequest?.capability)) as Record<string, string[]>;
      expect(capability[`conv:${conv}`]).toEqual(['subscribe']);
      expect(JSON.stringify(ownerToken.body)).not.toContain('testsecret');
      const outsiderToken = await call<RealtimeTokenResponse>(tokenRoute.POST, { as: outsider.clerkId, body: { conversationIds: [conv], crewIds: [crew.id] } });
      expect(outsiderToken.data.channels).toEqual([`user:${outsider.id}`]);
    } finally {
      overrideEnvForTests({ ABLY_API_KEY: undefined });
      delete process.env.ABLY_API_KEY;
    }
  });
});
