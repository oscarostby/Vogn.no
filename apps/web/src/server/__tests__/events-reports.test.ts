import type { ChatMessage, CrewChannel, CrewDetail, EventDetail, NotificationItem } from '@vogn/types';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as crewsRoute from '@/app/api/v1/crews/route';
import * as channelsRoute from '@/app/api/v1/crews/id/[crewId]/channels/route';
import * as joinRoute from '@/app/api/v1/crews/id/[crewId]/join/route';
import * as messagesRoute from '@/app/api/v1/conversations/[id]/messages/route';
import * as eventsRoute from '@/app/api/v1/events/route';
import * as eventRoute from '@/app/api/v1/events/[id]/route';
import * as attendeesRoute from '@/app/api/v1/events/[id]/attendees/route';
import * as rsvpRoute from '@/app/api/v1/events/[id]/rsvp/route';
import * as notificationsRoute from '@/app/api/v1/notifications/route';
import * as notificationsReadRoute from '@/app/api/v1/notifications/read/route';
import * as reportsRoute from '@/app/api/v1/reports/route';
import { call, createUser, type Harness, startHarness } from '@/test/harness';

let h: Harness;
let owner: Awaited<ReturnType<typeof createUser>>;
let member: Awaited<ReturnType<typeof createUser>>;
let outsider: Awaited<ReturnType<typeof createUser>>;
let crew: CrewDetail;

beforeAll(async () => {
  h = await startHarness();
  owner = await createUser();
  member = await createUser();
  outsider = await createUser();
  const created = await call<CrewDetail>(crewsRoute.POST, { as: owner.clerkId, body: { name: 'Test Meets', slug: `meets-${Math.random().toString(36).slice(2, 8)}`, category: 'general', visibility: 'public', template: 'standard', themePreset: 'tokyo-midnight' } });
  if (created.status !== 201) throw new Error(JSON.stringify(created.body));
  crew = created.data;
  expect((await call(joinRoute.POST, { as: member.clerkId, params: { crewId: crew.id }, body: {} })).status).toBe(200);
});

afterAll(async () => { await h?.stop(); });

function eventInput(visibility: 'public' | 'crew' | 'private' = 'crew') {
  return { crewId: crew.id, title: 'Cars and coffee', startsAt: new Date(Date.now() + 48 * 3600000).toISOString(), timezone: 'Europe/Oslo', visibility, rsvpLimit: 1, location: { name: 'Private meeting point', city: 'Oslo' }, locationVisibility: 'attendees' };
}

async function createEvent(visibility: 'public' | 'crew' | 'private' = 'crew') {
  const result = await call<EventDetail>(eventsRoute.POST, { as: owner.clerkId, body: eventInput(visibility) });
  expect(result.status).toBe(201);
  return result.data;
}

describe('events', () => {
  it('requires event-management permissions and hides crew events from outsiders', async () => {
    const denied = await call(eventsRoute.POST, { as: member.clerkId, body: eventInput() });
    expect(denied.status).toBe(403);
    const event = await createEvent();
    const memberView = await call<EventDetail>(eventRoute.GET, { as: member.clerkId, params: { id: event.id } });
    expect(memberView.status).toBe(200);
    expect(memberView.data.locationHidden).toBe(true);
    expect(memberView.data.location).toBeNull();
    expect((await call(eventRoute.GET, { as: outsider.clerkId, params: { id: event.id } })).status).toBe(404);
    const listed = await call<EventDetail[]>(eventsRoute.GET, { as: outsider.clerkId });
    expect(listed.data.some((item) => item.id === event.id)).toBe(false);
  });

  it('handles capacity and waitlist promotion while keeping attendee-only locations private', async () => {
    const event = await createEvent('public');
    const going = await call<EventDetail>(rsvpRoute.POST, { as: member.clerkId, params: { id: event.id }, body: { status: 'going' } });
    expect(going.data.viewerRsvp).toBe('going');
    expect(going.data.goingCount).toBe(1);
    expect(going.data.location?.name).toBe('Private meeting point');
    const waiting = await call<EventDetail>(rsvpRoute.POST, { as: outsider.clerkId, params: { id: event.id }, body: { status: 'going' } });
    expect(waiting.data.viewerRsvp).toBe('waitlist');
    expect(waiting.data.location).toBeNull();
    expect((await call(attendeesRoute.GET, { as: outsider.clerkId, params: { id: event.id } })).status).toBe(403);
    const leaving = await call<EventDetail>(rsvpRoute.POST, { as: member.clerkId, params: { id: event.id }, body: { status: 'not_going' } });
    expect(leaving.data.goingCount).toBe(1);
    const promoted = await call<EventDetail>(eventRoute.GET, { as: outsider.clerkId, params: { id: event.id } });
    expect(promoted.data.viewerRsvp).toBe('going');
    expect(promoted.data.location?.name).toBe('Private meeting point');
  });

  it('notifies attendees when cancelled, rejects further RSVP and scopes mark-read to the recipient', async () => {
    const event = await createEvent('public');
    await call(rsvpRoute.POST, { as: member.clerkId, params: { id: event.id }, body: { status: 'interested' } });
    expect((await call(eventRoute.PATCH, { as: outsider.clerkId, params: { id: event.id }, body: { status: 'cancelled' } })).status).toBe(403);
    expect((await call(eventRoute.PATCH, { as: owner.clerkId, params: { id: event.id }, body: { status: 'cancelled' } })).status).toBe(200);
    expect((await call(rsvpRoute.POST, { as: member.clerkId, params: { id: event.id }, body: { status: 'going' } })).status).toBe(403);
    const notifications = await call<NotificationItem[]>(notificationsRoute.GET, { as: member.clerkId });
    const item = notifications.data.find((entry) => entry.link === `/events/${event.id}`)!;
    expect(item).toBeDefined();
    expect(item.readAt).toBeNull();
    expect((await call<{ updated: number }>(notificationsReadRoute.POST, { as: outsider.clerkId, body: { ids: [item.id] } })).data.updated).toBe(0);
    expect((await call<{ updated: number }>(notificationsReadRoute.POST, { as: member.clerkId, body: { ids: [item.id] } })).data.updated).toBe(1);
  });
});

describe('reports', () => {
  it('validates authentication, target existence and the report reason', async () => {
    const input = { targetType: 'user', targetId: owner.id, reason: 'spam' };
    expect((await call(reportsRoute.POST, { body: input })).status).toBe(401);
    expect((await call(reportsRoute.POST, { as: member.clerkId, body: { ...input, reason: 'unknown' } })).status).toBe(422);
    expect((await call(reportsRoute.POST, { as: member.clerkId, body: { ...input, targetId: new ObjectId().toHexString() } })).status).toBe(404);
  });

  it('persists a minimal report and returns the existing open report on repeated submission', async () => {
    const input = { targetType: 'user', targetId: owner.id, reason: 'spam', details: 'Test report details' };
    const first = await call<{ id: string }>(reportsRoute.POST, { as: member.clerkId, body: input });
    const duplicate = await call<{ id: string }>(reportsRoute.POST, { as: member.clerkId, body: input });
    expect(first.status).toBe(201);
    expect(duplicate.data.id).toBe(first.data.id);
    const stored = await h.db.db.collection('reports').findOne({ _id: new ObjectId(first.data.id) });
    expect(stored?.scope).toBe('platform');
    expect(stored?.details).toBe('Test report details');
    expect(stored?.reporterId.toHexString()).toBe(member.id);
    expect(await h.db.db.collection('reports').countDocuments({ reporterId: new ObjectId(member.id), targetId: new ObjectId(owner.id) })).toBe(1);
  });

  it('prevents reports from being used to read crew-only events and channel messages', async () => {
    const event = await createEvent();
    const eventInput = { targetType: 'event', targetId: event.id, reason: 'other' };
    expect((await call(reportsRoute.POST, { as: outsider.clerkId, body: eventInput })).status).toBe(404);
    expect((await call(reportsRoute.POST, { as: member.clerkId, body: eventInput })).status).toBe(201);
    const channels = await call<CrewChannel[]>(channelsRoute.GET, { as: owner.clerkId, params: { crewId: crew.id } });
    const general = channels.data.find((channel) => channel.name === 'general')!;
    const message = await call<ChatMessage>(messagesRoute.POST, { as: owner.clerkId, params: { id: general.conversationId! }, body: { content: 'Reportable test message', idempotencyKey: `report-test-${Date.now()}` } });
    expect(message.status).toBe(201);
    const messageInput = { targetType: 'message', targetId: message.data.id, reason: 'other' };
    expect((await call(reportsRoute.POST, { as: outsider.clerkId, body: messageInput })).status).toBe(404);
    const saved = await call<{ id: string }>(reportsRoute.POST, { as: member.clerkId, body: messageInput });
    expect(saved.status).toBe(201);
    const stored = await h.db.db.collection('reports').findOne({ _id: new ObjectId(saved.data.id) });
    expect(stored?.excerpt).toBe('Reportable test message');
    expect(stored?.scope).toBe('crew');
    expect(stored?.crewId.toHexString()).toBe(crew.id);
  });
});
