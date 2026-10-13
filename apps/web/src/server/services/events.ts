import 'server-only';
import { decodeCursor, encodeCursor, type EventDoc, isDateIdCursor, runTransaction } from '@vogn/database';
import type { EventAttendee, EventDetail, EventSummary, RsvpStatus } from '@vogn/types';
import { type EventCreateInput, eventCreateSchema, eventListQuery, eventUpdateSchema } from '@vogn/validation';
import { ObjectId } from 'mongodb';
import type { z } from 'zod';
import type { AuthedContext, ServiceContext } from '../context';
import { badRequest, forbidden, notFound } from '../errors';
import { loadUserSummaries, toMediaRef } from '../mappers';
import { audit } from './audit';
import { type CrewAccess, getCrewAccess, requirePermission } from './crew-access';
import { resolveOwnedMediaEmbed } from './media';
import { notify } from './notifications';

interface EventAccess {
  event: EventDoc;
  crew: CrewAccess;
  canView: boolean;
  canManage: boolean;
  isMember: boolean;
  rsvp: RsvpStatus | null;
}

async function eventAccess(ctx: ServiceContext, event: EventDoc): Promise<EventAccess> {
  const crew = await getCrewAccess(ctx, event.crewId);
  const isMember = Boolean(crew.member);
  const isOrganizer = Boolean(ctx.actor?.userId.equals(event.organizerId));
  const canManage = isOrganizer || crew.permissions.has('MANAGE_EVENTS');
  const canView = event.visibility === 'public' ? !crew.crew.deletedAt : event.visibility === 'crew' ? isMember : canManage;
  const rsvp = ctx.actor ? await ctx.cols.eventRSVPs.findOne({ eventId: event._id, userId: ctx.actor.userId }, { projection: { status: 1 } }) : null;
  return { event, crew, canView, canManage, isMember, rsvp: rsvp?.status ?? null };
}

async function loadEvent(ctx: ServiceContext, id: ObjectId): Promise<EventAccess> {
  const event = await ctx.cols.events.findOne({ _id: id, deletedAt: null });
  if (!event) throw notFound('Event');
  const access = await eventAccess(ctx, event);
  if (!access.canView) throw notFound('Event');
  return access;
}

function toEventSummary(e: EventDoc, crew: { _id: ObjectId; slug: string; name: string; icon: EventDoc['coverImage'] }, viewerRsvp: RsvpStatus | null): EventSummary {
  return {
    id: e._id.toHexString(),
    crew: { id: crew._id.toHexString(), slug: crew.slug, name: crew.name, icon: toMediaRef(crew.icon) },
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt?.toISOString() ?? null,
    timezone: e.timezone,
    country: e.country,
    city: e.city,
    coverImage: toMediaRef(e.coverImage),
    visibility: e.visibility,
    status: e.status,
    goingCount: e.goingCount,
    interestedCount: e.interestedCount,
    rsvpLimit: e.rsvpLimit,
    viewerRsvp,
  };
}

function calendarLinks(e: EventDoc, locationText: string | null): EventDetail['calendar'] {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3600_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${fmt(e.startsAt)}/${fmt(end)}`,
    details: `${e.description ?? ''}\n\nhttps://vogn.no/events/${e._id.toHexString()}`.trim(),
    ctz: e.timezone,
  });
  if (locationText) params.set('location', locationText);
  return { googleUrl: `https://calendar.google.com/calendar/render?${params.toString()}`, icsPath: `/api/v1/events/${e._id.toHexString()}/ics` };
}

function locationVisible(a: EventAccess): boolean {
  if (!a.event.location) return false;
  if (a.canManage) return true;
  switch (a.event.locationVisibility) {
    case 'public':
      return true;
    case 'members':
      return a.isMember;
    case 'attendees':
      return a.rsvp === 'going';
    default:
      return false;
  }
}

async function toDetail(ctx: ServiceContext, a: EventAccess): Promise<EventDetail> {
  const e = a.event;
  const organizer = (await loadUserSummaries(ctx.cols.users, [e.organizerId])).get(e.organizerId.toHexString()) ?? null;
  const showLocation = locationVisible(a);
  const location = showLocation ? e.location : null;
  const locText = location ? [location.name, location.address, location.city].filter(Boolean).join(', ') : (e.city ?? null);
  return {
    ...toEventSummary(e, a.crew.crew, a.rsvp),
    description: e.description,
    organizer,
    location,
    locationHidden: Boolean(e.location) && !showLocation,
    locationVisibility: e.locationVisibility,
    attendeeListVisibility: e.attendeeListVisibility,
    safetyNotes: e.safetyNotes,
    canManage: a.canManage,
    calendar: calendarLinks(e, locText),
    createdAt: e.createdAt.toISOString(),
  };
}

export async function getEvent(ctx: ServiceContext, id: ObjectId): Promise<EventDetail> {
  return toDetail(ctx, await loadEvent(ctx, id));
}

export async function createEvent(ctx: AuthedContext, raw: EventCreateInput): Promise<EventDetail> {
  const input = eventCreateSchema.parse(raw);
  const crewId = ObjectId.createFromHexString(input.crewId);
  const crew = await getCrewAccess(ctx, crewId);
  requirePermission(crew, 'MANAGE_EVENTS');
  if (new Date(input.startsAt).getTime() < ctx.now.getTime() - 3600_000) throw badRequest('Events must start in the future.', { startsAt: 'validation.event.past' });
  const cover = await resolveOwnedMediaEmbed(ctx, input.coverMediaId, ['event_cover'], crewId);
  const doc: EventDoc = {
    _id: new ObjectId(),
    crewId,
    organizerId: ctx.actor.userId,
    title: input.title,
    description: input.description ?? null,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    timezone: input.timezone,
    country: input.country ?? crew.crew.country,
    city: input.city ?? input.location?.city ?? null,
    location: input.location ?? null,
    locationVisibility: input.locationVisibility,
    visibility: crew.crew.visibility === 'hidden' && input.visibility === 'public' ? 'crew' : input.visibility,
    attendeeListVisibility: input.attendeeListVisibility,
    rsvpLimit: input.rsvpLimit ?? null,
    coverImage: cover ?? null,
    safetyNotes: input.safetyNotes ?? null,
    status: 'scheduled',
    goingCount: 0,
    interestedCount: 0,
    remindersSentAt: null,
    deletedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  await ctx.cols.events.insertOne(doc);
  await ctx.cols.crews.updateOne({ _id: crewId }, { $inc: { activityScore: 3 } });
  await audit(ctx, { action: 'event.created', targetType: 'event', targetId: doc._id, crewId });
  return getEvent(ctx, doc._id);
}

export async function updateEvent(ctx: AuthedContext, id: ObjectId, raw: z.input<typeof eventUpdateSchema>): Promise<EventDetail> {
  const input = eventUpdateSchema.parse(raw);
  const a = await loadEvent(ctx, id);
  if (!a.canManage) throw forbidden();
  const set: Partial<EventDoc> = { updatedAt: ctx.now };
  if (input.title !== undefined) set.title = input.title;
  if (input.description !== undefined) set.description = input.description ?? null;
  if (input.startsAt !== undefined) set.startsAt = new Date(input.startsAt);
  if (input.endsAt !== undefined) set.endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (input.timezone !== undefined) set.timezone = input.timezone;
  if (input.country !== undefined) set.country = input.country ?? null;
  if (input.city !== undefined) set.city = input.city ?? null;
  if (input.location !== undefined) set.location = input.location ?? null;
  if (input.locationVisibility !== undefined) set.locationVisibility = input.locationVisibility;
  if (input.visibility !== undefined) set.visibility = input.visibility;
  if (input.attendeeListVisibility !== undefined) set.attendeeListVisibility = input.attendeeListVisibility;
  if (input.rsvpLimit !== undefined) set.rsvpLimit = input.rsvpLimit ?? null;
  if (input.safetyNotes !== undefined) set.safetyNotes = input.safetyNotes ?? null;
  if (input.status !== undefined) set.status = input.status;
  const cover = await resolveOwnedMediaEmbed(ctx, input.coverMediaId, ['event_cover'], a.event.crewId);
  if (cover !== undefined) set.coverImage = cover;
  const end = set.endsAt === undefined ? a.event.endsAt : set.endsAt;
  const start = set.startsAt ?? a.event.startsAt;
  if (end && end <= start) throw badRequest('The end must be after the start.', { endsAt: 'validation.event.endsBeforeStart' });
  await ctx.cols.events.updateOne({ _id: id }, { $set: set });
  await audit(ctx, { action: input.status === 'cancelled' ? 'event.cancelled' : 'event.updated', targetType: 'event', targetId: id, crewId: a.event.crewId });

  const important = input.announce || input.status === 'cancelled' || input.startsAt !== undefined || input.location !== undefined;
  if (important) {
    const attendees = await ctx.cols.eventRSVPs.find({ eventId: id, status: { $in: ['going', 'interested', 'waitlist'] } }, { projection: { userId: 1 } }).limit(2000).toArray();
    for (const r of attendees) {
      await notify(ctx, {
        userId: r.userId,
        type: 'event_update',
        actorId: ctx.actor.userId,
        crewId: a.event.crewId,
        title: input.status === 'cancelled' ? `Cancelled: ${set.title ?? a.event.title}` : `Updated: ${set.title ?? a.event.title}`,
        link: `/events/${id.toHexString()}`,
        groupKey: `event_update:${id.toHexString()}`,
      });
    }
  }
  return getEvent(ctx, id);
}

export async function deleteEvent(ctx: AuthedContext, id: ObjectId): Promise<void> {
  const a = await loadEvent(ctx, id);
  if (!a.canManage) throw forbidden();
  await ctx.cols.events.updateOne({ _id: id }, { $set: { deletedAt: ctx.now, updatedAt: ctx.now } });
  await audit(ctx, { action: 'event.deleted', targetType: 'event', targetId: id, crewId: a.event.crewId });
}

const COUNTER: Partial<Record<RsvpStatus, 'goingCount' | 'interestedCount'>> = { going: 'goingCount', interested: 'interestedCount' };

/** RSVP with capacity handling: full events put new "going" responses on the waitlist; leaving promotes the next in line. */
export async function rsvp(ctx: AuthedContext, id: ObjectId, requested: 'going' | 'interested' | 'not_going'): Promise<EventDetail> {
  const a = await loadEvent(ctx, id);
  if (a.event.status === 'cancelled') throw forbidden('This event was cancelled.');
  if (a.event.visibility !== 'public' && !a.isMember) throw forbidden('Join the crew to RSVP.');
  if (a.event.endsAt ? a.event.endsAt < ctx.now : a.event.startsAt.getTime() + 12 * 3600_000 < ctx.now.getTime()) throw forbidden('This event has ended.');

  await runTransaction(
    ctx.client,
    async (session) => {
      const event = (await ctx.cols.events.findOne({ _id: id }, { session }))!;
      const prev = await ctx.cols.eventRSVPs.findOne({ eventId: id, userId: ctx.actor.userId }, { session });
      let status: RsvpStatus = requested;
      if (requested === 'going' && prev?.status !== 'going' && event.rsvpLimit !== null && event.goingCount >= event.rsvpLimit) status = 'waitlist';
      if (prev?.status === status) return;
      const inc: Record<string, number> = {};
      const prevCounter = prev ? COUNTER[prev.status] : undefined;
      const nextCounter = COUNTER[status];
      if (prevCounter) inc[prevCounter] = (inc[prevCounter] ?? 0) - 1;
      if (nextCounter) inc[nextCounter] = (inc[nextCounter] ?? 0) + 1;
      await ctx.cols.eventRSVPs.updateOne(
        { eventId: id, userId: ctx.actor.userId },
        { $set: { status, updatedAt: ctx.now }, $setOnInsert: { _id: new ObjectId(), createdAt: ctx.now } },
        { upsert: true, session },
      );
      if (Object.keys(inc).length) await ctx.cols.events.updateOne({ _id: id }, { $inc: inc }, { session });
      // Promote from the waitlist when a seat frees up.
      if (prev?.status === 'going' && status !== 'going' && event.rsvpLimit !== null) {
        const next = await ctx.cols.eventRSVPs.findOneAndUpdate(
          { eventId: id, status: 'waitlist' },
          { $set: { status: 'going', updatedAt: ctx.now } },
          { sort: { createdAt: 1 }, session },
        );
        if (next) await ctx.cols.events.updateOne({ _id: id }, { $inc: { goingCount: 1 } }, { session });
      }
    },
    { enabled: ctx.transactions },
  );
  return getEvent(ctx, id);
}

export async function listAttendees(ctx: AuthedContext, id: ObjectId): Promise<EventAttendee[]> {
  const a = await loadEvent(ctx, id);
  const allowed =
    a.canManage || a.event.attendeeListVisibility === 'public' || (a.event.attendeeListVisibility === 'members' && a.isMember);
  if (!allowed) throw forbidden('The attendee list is private.');
  const rows = await ctx.cols.eventRSVPs.find({ eventId: id, status: { $in: ['going', 'interested', 'waitlist'] } }).sort({ createdAt: 1 }).limit(1000).toArray();
  const users = await loadUserSummaries(ctx.cols.users, rows.map((r) => r.userId));
  return rows
    .filter((r) => users.has(r.userId.toHexString()))
    .map((r) => ({ user: users.get(r.userId.toHexString())!, status: r.status, respondedAt: r.updatedAt.toISOString() }));
}

export async function listEvents(ctx: ServiceContext, raw: z.input<typeof eventListQuery>) {
  const q = eventListQuery.parse(raw);
  const filter: Record<string, unknown> = { deletedAt: null };
  const now = new Date();
  let visibleCrewIds: ObjectId[] = [];
  let manageCrewIds: ObjectId[] = [];
  if (ctx.actor) {
    const memberships = await ctx.cols.crewMembers.find({ userId: ctx.actor.userId, status: 'active' }, { projection: { crewId: 1 } }).toArray();
    visibleCrewIds = memberships.map((m) => m.crewId);
  }
  if (q.crewId) {
    const crewId = ObjectId.createFromHexString(q.crewId);
    const crew = await getCrewAccess(ctx, crewId);
    if (!crew.canView) throw notFound('Crew');
    filter.crewId = crewId;
    if (crew.permissions.has('MANAGE_EVENTS')) manageCrewIds = [crewId];
    filter.$or = crew.member
      ? [{ visibility: { $in: ['public', 'crew'] } }, ...(manageCrewIds.length ? [{ visibility: 'private' }] : [])]
      : [{ visibility: 'public' }];
  } else {
    filter.$or = [{ visibility: 'public' }, { crewId: { $in: visibleCrewIds }, visibility: 'crew' }];
  }
  if (q.country) filter.country = q.country;
  if (q.scope === 'mine' && ctx.actor) {
    const mine = await ctx.cols.eventRSVPs.find({ userId: ctx.actor.userId, status: { $in: ['going', 'interested', 'waitlist'] } }, { projection: { eventId: 1 } }).limit(500).toArray();
    filter._id = { $in: mine.map((m) => m.eventId) };
  }
  const past = q.scope === 'past';
  const c = decodeCursor(q.cursor, isDateIdCursor);
  const timeFilter = past ? { startsAt: { $lt: now } } : { $or: [{ startsAt: { $gte: new Date(now.getTime() - 6 * 3600_000) } }] };
  const and: Record<string, unknown>[] = [timeFilter];
  if (c) {
    const at = new Date(c.t);
    const id = ObjectId.createFromHexString(c.id);
    and.push(past ? { $or: [{ startsAt: { $lt: at } }, { startsAt: at, _id: { $lt: id } }] } : { $or: [{ startsAt: { $gt: at } }, { startsAt: at, _id: { $gt: id } }] });
  }
  filter.$and = and;
  const docs = await ctx.cols.events.find(filter).sort(past ? { startsAt: -1, _id: -1 } : { startsAt: 1, _id: 1 }).limit(q.limit).toArray();
  const crews = await ctx.cols.crews.find({ _id: { $in: docs.map((d) => d.crewId) }, deletedAt: null }, { projection: { slug: 1, name: 1, icon: 1 } }).toArray();
  const crewById = new Map(crews.map((c2) => [c2._id.toHexString(), c2]));
  const rsvps = ctx.actor
    ? await ctx.cols.eventRSVPs.find({ userId: ctx.actor.userId, eventId: { $in: docs.map((d) => d._id) } }, { projection: { eventId: 1, status: 1 } }).toArray()
    : [];
  const rsvpBy = new Map(rsvps.map((r) => [r.eventId.toHexString(), r.status]));
  const items = docs
    .filter((d) => crewById.has(d.crewId.toHexString()))
    .map((d) => toEventSummary(d, crewById.get(d.crewId.toHexString())!, rsvpBy.get(d._id.toHexString()) ?? null));
  const last = docs[docs.length - 1];
  return { items, nextCursor: docs.length === q.limit && last ? encodeCursor({ t: last.startsAt.getTime(), id: last._id.toHexString() }) : null };
}

export async function upcomingCrewEvents(ctx: ServiceContext, crewIds: ObjectId[], limit: number, includeCrewOnly: boolean): Promise<EventSummary[]> {
  if (!crewIds.length) return [];
  const docs = await ctx.cols.events
    .find({
      crewId: { $in: crewIds },
      deletedAt: null,
      status: 'scheduled',
      startsAt: { $gte: new Date(Date.now() - 3 * 3600_000) },
      visibility: { $in: includeCrewOnly ? ['public', 'crew'] : ['public'] },
    })
    .sort({ startsAt: 1 })
    .limit(limit)
    .toArray();
  const crews = await ctx.cols.crews.find({ _id: { $in: crewIds } }, { projection: { slug: 1, name: 1, icon: 1 } }).toArray();
  const byId = new Map(crews.map((c) => [c._id.toHexString(), c]));
  const rsvps = ctx.actor
    ? await ctx.cols.eventRSVPs.find({ userId: ctx.actor.userId, eventId: { $in: docs.map((d) => d._id) } }, { projection: { eventId: 1, status: 1 } }).toArray()
    : [];
  const rsvpBy = new Map(rsvps.map((r) => [r.eventId.toHexString(), r.status]));
  return docs.filter((d) => byId.has(d.crewId.toHexString())).map((d) => toEventSummary(d, byId.get(d.crewId.toHexString())!, rsvpBy.get(d._id.toHexString()) ?? null));
}

/** iCalendar export (RFC 5545). Location included only if the viewer may see it. */
export async function eventIcs(ctx: ServiceContext, id: ObjectId): Promise<string> {
  const a = await loadEvent(ctx, id);
  const e = a.event;
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const loc = locationVisible(a) && e.location ? [e.location.name, e.location.address, e.location.city].filter(Boolean).join(', ') : (e.city ?? '');
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 3 * 3600_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VOGN//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e._id.toHexString()}@vogn.no`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.startsAt)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(`${e.description ?? ''}\n\nhttps://vogn.no/events/${e._id.toHexString()}`.trim())}`,
    loc ? `LOCATION:${esc(loc)}` : null,
    e.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** Cron: reminders for events starting within 24 hours. */
export async function sendEventReminders(ctx: ServiceContext): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600_000);
  const events = await ctx.cols.events.find({ status: 'scheduled', deletedAt: null, startsAt: { $gte: now, $lte: soon }, remindersSentAt: null }).limit(100).toArray();
  let sent = 0;
  for (const e of events) {
    const claimed = await ctx.cols.events.updateOne({ _id: e._id, remindersSentAt: null }, { $set: { remindersSentAt: now } });
    if (!claimed.modifiedCount) continue;
    const rows = await ctx.cols.eventRSVPs.find({ eventId: e._id, status: { $in: ['going', 'interested'] } }, { projection: { userId: 1 } }).limit(5000).toArray();
    for (const r of rows) {
      await notify(ctx, { userId: r.userId, type: 'event_reminder', crewId: e.crewId, title: `Tomorrow: ${e.title}`, link: `/events/${e._id.toHexString()}` });
      sent++;
    }
  }
  return sent;
}
