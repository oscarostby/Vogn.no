'use client';

import { createApiClient } from '@vogn/api-client';

/** Same-origin client: the Clerk session cookie authenticates requests (no tokens in JS). */
export const api = createApiClient({
  baseUrl: '',
  getLocale: () => (typeof document !== 'undefined' ? document.documentElement.lang : undefined),
});

export const queryKeys = {
  me: ['me'] as const,
  home: ['me', 'home'] as const,
  myCrews: ['crews', 'mine'] as const,
  crew: (slug: string) => ['crew', slug] as const,
  crewChannels: (crewId: string) => ['crew', crewId, 'channels'] as const,
  crewRoles: (crewId: string) => ['crew', crewId, 'roles'] as const,
  crewMembers: (crewId: string, q?: string) => ['crew', crewId, 'members', q ?? ''] as const,
  crewTheme: (crewId: string) => ['crew', crewId, 'theme'] as const,
  crewStudio: (crewId: string) => ['crew', crewId, 'studio'] as const,
  crewWidgets: (crewId: string, page: string) => ['crew', crewId, 'widgets', page] as const,
  profile: (username: string) => ['profile', username.toLowerCase()] as const,
  garage: (username: string) => ['garage', username.toLowerCase()] as const,
  vehicle: (id: string) => ['vehicle', id] as const,
  vehicleUpdates: (id: string) => ['vehicle', id, 'updates'] as const,
  vehicleComments: (id: string) => ['vehicle', id, 'comments'] as const,
  conversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (id: string) => ['conversation', id, 'messages'] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  events: (scope: string, crewId?: string) => ['events', scope, crewId ?? ''] as const,
  event: (id: string) => ['event', id] as const,
  verification: ['verification'] as const,
  discoverCrews: (filters: Record<string, unknown>) => ['discover', 'crews', filters] as const,
  discoverBuilds: (filters: Record<string, unknown>) => ['discover', 'builds', filters] as const,
};
