import type { Id, ISODate, MediaRef } from './common';
import type { UserSummary } from './user';

export type EventVisibility = 'public' | 'crew' | 'private';
export type LocationVisibility = 'public' | 'members' | 'attendees';
export type AttendeeListVisibility = 'public' | 'members' | 'organizers';
export type RsvpStatus = 'going' | 'interested' | 'not_going' | 'waitlist';
export type EventStatus = 'scheduled' | 'cancelled';

export interface EventLocation {
  name: string;
  address: string | null;
  city: string | null;
  /** Coordinates are optional and only stored when the organiser chooses to. */
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}

export interface EventSummary {
  id: Id;
  crew: { id: Id; slug: string; name: string; icon: MediaRef | null };
  title: string;
  startsAt: ISODate;
  endsAt: ISODate | null;
  timezone: string;
  country: string | null;
  city: string | null;
  coverImage: MediaRef | null;
  visibility: EventVisibility;
  status: EventStatus;
  goingCount: number;
  interestedCount: number;
  rsvpLimit: number | null;
  viewerRsvp: RsvpStatus | null;
}

export interface EventDetail extends EventSummary {
  description: string | null;
  organizer: UserSummary | null;
  location: EventLocation | null;
  /** True when a location exists but the viewer is not allowed to see it. */
  locationHidden: boolean;
  locationVisibility: LocationVisibility;
  attendeeListVisibility: AttendeeListVisibility;
  safetyNotes: string | null;
  canManage: boolean;
  calendar: { googleUrl: string; icsPath: string };
  createdAt: ISODate;
}

export interface EventAttendee {
  user: UserSummary;
  status: RsvpStatus;
  respondedAt: ISODate;
}
