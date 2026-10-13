import type {
  AdminStats,
  AppealDto,
  AuditLogEntry,
  BuildFeedItem,
  BuildUpdate,
  ChatMessage,
  ConnectionItem,
  ConversationSummary,
  CrewApplication,
  CrewChannel,
  CrewDetail,
  CrewInvitation,
  CrewMember,
  CrewRole,
  CrewSummary,
  EventAttendee,
  EventDetail,
  EventSummary,
  InvitePreview,
  MeProfile,
  MessageSyncResult,
  ModerationActionDto,
  NotificationItem,
  OfficialVehicleData,
  OnboardingState,
  Paginated,
  PublicProfile,
  RealtimeTokenResponse,
  ReportDto,
  UserSummary,
  VehicleComment,
  VehicleDetail,
  VehicleProviderInfo,
  VehicleSummary,
  VerificationRequestDto,
  VerificationResultDto,
  VerificationReviewItem,
} from '@vogn/types';
import type {
  ApplicationSubmitInput,
  BuildUpdateCreateInput,
  ChannelCreateInput,
  CrewCreateInput,
  CrewModerationInput,
  CrewUpdateInput,
  DmCreateInput,
  EventCreateInput,
  MediaCompleteInput,
  MediaSignInput,
  MessageSendInput,
  ModificationsInput,
  OnboardingInput,
  ProfileUpdateInput,
  ReportCreateInput,
  SettingsUpdateInput,
  VehicleCreateInput,
  VehicleUpdateInput,
  VerificationStartInput,
} from '@vogn/validation';
import type { ThemeInstallMode, ThemeManifest } from '@vogn/theme-engine';
import type {
  CrewThemeState,
  CrewWidgetPayload,
  HomeFeed,
  MediaSignResponse,
  PollResult,
  PrivateUploadResponse,
  PublishedCrewTheme,
  SearchResults,
  SystemHealth,
  ThemeListing,
  ThemeListingDetail,
  ThemeVersionSummary,
  UploadedMedia,
  VoiceTokenResponse,
} from './dto';
import { type ApiClientOptions, createHttp, type QueryValue } from './http';

const e = encodeURIComponent;

async function paginated<T>(
  http: ReturnType<typeof createHttp>,
  path: string,
  query?: Record<string, QueryValue>,
): Promise<Paginated<T>> {
  const res = await http.getWithMeta<T[]>(path, { query });
  return { items: res.data, nextCursor: (res.meta?.nextCursor as string | null | undefined) ?? null };
}

export function createApiClient(options: ApiClientOptions) {
  const http = createHttp(options);

  return {
    http,

    me: {
      get: () => http.get<MeProfile | OnboardingState>('/me'),
      onboard: (input: OnboardingInput) => http.post<MeProfile>('/me/onboarding', input),
      update: (input: ProfileUpdateInput) => http.patch<MeProfile>('/me', input),
      updateSettings: (input: SettingsUpdateInput) => http.patch<MeProfile>('/me/settings', input),
      usernameAvailable: (username: string) =>
        http.get<{ available: boolean; reason: string | null }>('/me/username-availability', { query: { username } }),
      home: () => http.get<HomeFeed>('/me/home'),
      exportData: () => http.get<Record<string, unknown>>('/me/export'),
      deleteAccount: (input: { confirmUsername: string; reason?: string | null }) =>
        http.post<{ deleted: true }>('/me/delete', input),
      blocks: () => http.get<UserSummary[]>('/me/blocks'),
      connections: (status: 'friends' | 'incoming' | 'outgoing' | 'followers' | 'following', cursor?: string) =>
        paginated<ConnectionItem>(http, '/me/connections', { status, cursor }),
      registerPushToken: (input: { token: string; platform: 'ios' | 'android' }) => http.post<{ ok: true }>('/me/push-tokens', input),
      removePushToken: (token: string) => http.del<{ ok: true }>('/me/push-tokens', { token }),
    },

    users: {
      profile: (username: string) => http.get<PublicProfile>(`/users/${e(username)}`),
      garage: (username: string) => http.get<VehicleSummary[]>(`/users/${e(username)}/garage`),
      connection: (userId: string, action: 'request' | 'accept' | 'decline' | 'cancel' | 'remove' | 'follow' | 'unfollow') =>
        http.post<PublicProfile['relationship']>(`/users/id/${e(userId)}/connection`, { action }),
      block: (userId: string) => http.post<{ blocked: true }>(`/users/id/${e(userId)}/block`),
      unblock: (userId: string) => http.del<{ blocked: false }>(`/users/id/${e(userId)}/block`),
    },

    vehicles: {
      create: (input: VehicleCreateInput) => http.post<VehicleDetail>('/vehicles', input),
      get: (id: string) => http.get<VehicleDetail>(`/vehicles/${e(id)}`),
      update: (id: string, input: VehicleUpdateInput) => http.patch<VehicleDetail>(`/vehicles/${e(id)}`, input),
      delete: (id: string) => http.del<{ deleted: true }>(`/vehicles/${e(id)}`),
      setModifications: (id: string, input: ModificationsInput) => http.put<VehicleDetail>(`/vehicles/${e(id)}/modifications`, input),
      setGallery: (id: string, mediaIds: string[]) => http.put<VehicleDetail>(`/vehicles/${e(id)}/gallery`, { mediaIds }),
      updates: (id: string, cursor?: string) => paginated<BuildUpdate>(http, `/vehicles/${e(id)}/updates`, { cursor }),
      createUpdate: (id: string, input: BuildUpdateCreateInput) => http.post<BuildUpdate>(`/vehicles/${e(id)}/updates`, input),
      updateUpdate: (id: string, updateId: string, input: Partial<BuildUpdateCreateInput>) =>
        http.patch<BuildUpdate>(`/vehicles/${e(id)}/updates/${e(updateId)}`, input),
      deleteUpdate: (id: string, updateId: string) => http.del<{ deleted: true }>(`/vehicles/${e(id)}/updates/${e(updateId)}`),
      like: (id: string) => http.post<{ liked: boolean; likeCount: number }>(`/vehicles/${e(id)}/like`),
      unlike: (id: string) => http.del<{ liked: boolean; likeCount: number }>(`/vehicles/${e(id)}/like`),
      comments: (id: string, cursor?: string) => paginated<VehicleComment>(http, `/vehicles/${e(id)}/comments`, { cursor }),
      comment: (id: string, body: string) => http.post<VehicleComment>(`/vehicles/${e(id)}/comments`, { body }),
      deleteComment: (id: string, commentId: string) => http.del<{ deleted: true }>(`/vehicles/${e(id)}/comments/${e(commentId)}`),
      providers: () => http.get<VehicleProviderInfo[]>('/vehicles/providers'),
      lookup: (input: { countryCode: string; registrationNumber: string }) =>
        http.post<OfficialVehicleData>('/vehicles/lookup', input),
      refreshOfficialData: (id: string) => http.post<VehicleDetail>(`/vehicles/${e(id)}/official-data`),
    },

    discover: {
      builds: (query: Record<string, QueryValue> = {}) => paginated<BuildFeedItem>(http, '/discover/builds', query),
      crews: (query: Record<string, QueryValue> = {}) => paginated<CrewSummary>(http, '/discover/crews', query),
    },

    search: (q: string, type: 'all' | 'users' | 'crews' | 'vehicles' = 'all') =>
      http.get<SearchResults>('/search', { query: { q, type } }),

    crews: {
      mine: () => http.get<(CrewSummary & { unreadCount: number; mentionCount: number })[]>('/crews'),
      create: (input: CrewCreateInput) => http.post<CrewDetail>('/crews', input),
      slugAvailable: (slug: string) => http.get<{ available: boolean }>('/crews/slug-availability', { query: { slug } }),
      get: (slug: string) => http.get<CrewDetail>(`/crews/${e(slug)}`),
      update: (crewId: string, input: CrewUpdateInput) => http.patch<CrewDetail>(`/crews/id/${e(crewId)}`, input),
      delete: (crewId: string, confirmSlug: string) => http.del<{ deleted: true }>(`/crews/id/${e(crewId)}`, { confirmSlug }),
      join: (crewId: string, inviteCode?: string) => http.post<CrewDetail>(`/crews/id/${e(crewId)}/join`, { inviteCode }),
      leave: (crewId: string) => http.post<{ left: true }>(`/crews/id/${e(crewId)}/leave`),
      transferOwnership: (crewId: string, userId: string, confirmSlug: string) =>
        http.post<CrewDetail>(`/crews/id/${e(crewId)}/transfer`, { userId, confirmSlug }),
      updateSelf: (crewId: string, input: { nickname?: string | null; accentColor?: string | null }) =>
        http.patch<CrewMember>(`/crews/id/${e(crewId)}/me`, input),
      notificationSettings: (crewId: string, input: { level?: 'all' | 'mentions' | 'nothing'; mutedUntil?: string | null; suppressEveryone?: boolean }) =>
        http.patch<{ ok: true }>(`/crews/id/${e(crewId)}/notifications`, input),

      members: (crewId: string, query: { cursor?: string; q?: string; roleId?: string } = {}) =>
        paginated<CrewMember>(http, `/crews/id/${e(crewId)}/members`, query),
      updateMember: (crewId: string, userId: string, input: { roleIds?: string[]; nickname?: string | null; accentColor?: string | null }) =>
        http.patch<CrewMember>(`/crews/id/${e(crewId)}/members/${e(userId)}`, input),
      moderate: (crewId: string, input: CrewModerationInput) => http.post<{ ok: true }>(`/crews/id/${e(crewId)}/moderation`, input),
      moderationLog: (crewId: string, cursor?: string) =>
        paginated<ModerationActionDto>(http, `/crews/id/${e(crewId)}/moderation`, { cursor }),
      bans: (crewId: string) => http.get<CrewMember[]>(`/crews/id/${e(crewId)}/bans`),
      auditLog: (crewId: string, cursor?: string) => paginated<AuditLogEntry>(http, `/crews/id/${e(crewId)}/audit-log`, { cursor }),
      reports: (crewId: string, status: 'open' | 'all' = 'open') => http.get<ReportDto[]>(`/crews/id/${e(crewId)}/reports`, { query: { status } }),

      roles: (crewId: string) => http.get<CrewRole[]>(`/crews/id/${e(crewId)}/roles`),
      createRole: (crewId: string, input: Partial<CrewRole>) => http.post<CrewRole>(`/crews/id/${e(crewId)}/roles`, input),
      updateRole: (crewId: string, roleId: string, input: Partial<CrewRole>) =>
        http.patch<CrewRole>(`/crews/id/${e(crewId)}/roles/${e(roleId)}`, input),
      deleteRole: (crewId: string, roleId: string) => http.del<{ deleted: true }>(`/crews/id/${e(crewId)}/roles/${e(roleId)}`),
      reorderRoles: (crewId: string, roleIds: string[]) => http.put<CrewRole[]>(`/crews/id/${e(crewId)}/roles`, { roleIds }),

      channels: (crewId: string) => http.get<CrewChannel[]>(`/crews/id/${e(crewId)}/channels`),
      createChannel: (crewId: string, input: ChannelCreateInput) => http.post<CrewChannel>(`/crews/id/${e(crewId)}/channels`, input),
      updateChannel: (crewId: string, channelId: string, input: Partial<ChannelCreateInput>) =>
        http.patch<CrewChannel>(`/crews/id/${e(crewId)}/channels/${e(channelId)}`, input),
      deleteChannel: (crewId: string, channelId: string) =>
        http.del<{ deleted: true }>(`/crews/id/${e(crewId)}/channels/${e(channelId)}`),
      reorderChannels: (crewId: string, items: { id: string; position: number; parentId: string | null }[]) =>
        http.put<CrewChannel[]>(`/crews/id/${e(crewId)}/channels`, { items }),

      invites: (crewId: string) => http.get<CrewInvitation[]>(`/crews/id/${e(crewId)}/invites`),
      createInvite: (crewId: string, input: { maxUses?: number | null; expiresInHours?: number | null }) =>
        http.post<CrewInvitation>(`/crews/id/${e(crewId)}/invites`, input),
      revokeInvite: (crewId: string, inviteId: string) => http.del<{ revoked: true }>(`/crews/id/${e(crewId)}/invites/${e(inviteId)}`),

      apply: (crewId: string, input: ApplicationSubmitInput) => http.post<CrewApplication>(`/crews/id/${e(crewId)}/applications`, input),
      applications: (crewId: string, status: 'pending' | 'approved' | 'rejected' = 'pending', cursor?: string) =>
        paginated<CrewApplication>(http, `/crews/id/${e(crewId)}/applications`, { status, cursor }),
      reviewApplication: (crewId: string, applicationId: string, input: { decision: 'approve' | 'reject'; note?: string | null }) =>
        http.post<CrewApplication>(`/crews/id/${e(crewId)}/applications/${e(applicationId)}/review`, input),
      withdrawApplication: (crewId: string) => http.del<{ withdrawn: true }>(`/crews/id/${e(crewId)}/applications/mine`),

      theme: {
        published: (crewId: string) => http.get<PublishedCrewTheme>(`/crews/id/${e(crewId)}/theme`),
        studio: (crewId: string) => http.get<CrewThemeState>(`/crews/id/${e(crewId)}/theme/draft`),
        saveDraft: (crewId: string, manifest: ThemeManifest) =>
          http.put<CrewThemeState>(`/crews/id/${e(crewId)}/theme/draft`, { manifest }),
        publish: (crewId: string, note?: string) => http.post<CrewThemeState>(`/crews/id/${e(crewId)}/theme/publish`, { note }),
        versions: (crewId: string) => http.get<ThemeVersionSummary[]>(`/crews/id/${e(crewId)}/theme/versions`),
        version: (crewId: string, version: number) => http.get<ThemeManifest>(`/crews/id/${e(crewId)}/theme/versions/${version}`),
        restore: (crewId: string, version: number, publish = false) =>
          http.post<CrewThemeState>(`/crews/id/${e(crewId)}/theme/versions/${version}/restore`, { publish }),
        import: (crewId: string, manifest: unknown) => http.post<CrewThemeState>(`/crews/id/${e(crewId)}/theme/import`, { manifest }),
        exportUrl: (crewId: string) => `${options.baseUrl}/api/v1/crews/id/${e(crewId)}/theme/export`,
        applyPreset: (crewId: string, presetId: string, mode: ThemeInstallMode) =>
          http.post<CrewThemeState>(`/crews/id/${e(crewId)}/theme/preset`, { presetId, mode }),
      },
      widgets: (crewId: string, page = 'home') => http.get<CrewWidgetPayload>(`/crews/id/${e(crewId)}/widgets`, { query: { page } }),
      poll: (crewId: string, widgetId: string) => http.get<PollResult>(`/crews/id/${e(crewId)}/polls/${e(widgetId)}`),
      vote: (crewId: string, widgetId: string, optionIndex: number) =>
        http.post<PollResult>(`/crews/id/${e(crewId)}/polls/${e(widgetId)}`, { optionIndex }),
      voiceToken: (crewId: string, channelId: string) =>
        http.post<VoiceTokenResponse>(`/crews/id/${e(crewId)}/channels/${e(channelId)}/voice-token`),
    },

    invites: {
      preview: (code: string) => http.get<InvitePreview>(`/invites/${e(code)}`),
      accept: (code: string) => http.post<CrewDetail>(`/invites/${e(code)}`),
    },

    conversations: {
      list: (query: { kind?: 'dm' | 'all'; cursor?: string } = {}) => paginated<ConversationSummary>(http, '/conversations', query),
      get: (id: string) => http.get<ConversationSummary>(`/conversations/${e(id)}`),
      createDm: (input: DmCreateInput) => http.post<ConversationSummary>('/conversations', input),
      updateGroup: (id: string, input: { name?: string | null; addUserIds?: string[]; removeUserId?: string }) =>
        http.patch<ConversationSummary>(`/conversations/${e(id)}`, input),
      leave: (id: string) => http.post<{ left: true }>(`/conversations/${e(id)}/leave`),
      messages: (id: string, query: { before?: number; after?: number; around?: number; limit?: number } = {}) =>
        http.get<ChatMessage[]>(`/conversations/${e(id)}/messages`, { query }),
      sync: (id: string, query: { afterSeq: number; updatedSince?: string; limit?: number }) =>
        http.get<MessageSyncResult>(`/conversations/${e(id)}/sync`, { query }),
      send: (id: string, input: MessageSendInput) => http.post<ChatMessage>(`/conversations/${e(id)}/messages`, input),
      edit: (id: string, messageId: string, content: string) =>
        http.patch<ChatMessage>(`/conversations/${e(id)}/messages/${e(messageId)}`, { content }),
      delete: (id: string, messageId: string) => http.del<ChatMessage>(`/conversations/${e(id)}/messages/${e(messageId)}`),
      react: (id: string, messageId: string, emoji: string) =>
        http.post<ChatMessage>(`/conversations/${e(id)}/messages/${e(messageId)}/reactions`, { emoji }),
      unreact: (id: string, messageId: string, emoji: string) =>
        http.del<ChatMessage>(`/conversations/${e(id)}/messages/${e(messageId)}/reactions`, { emoji }),
      pin: (id: string, messageId: string) => http.post<ChatMessage>(`/conversations/${e(id)}/messages/${e(messageId)}/pin`),
      unpin: (id: string, messageId: string) => http.del<ChatMessage>(`/conversations/${e(id)}/messages/${e(messageId)}/pin`),
      pins: (id: string) => http.get<ChatMessage[]>(`/conversations/${e(id)}/pins`),
      search: (id: string, q: string, beforeSeq?: number) =>
        http.get<ChatMessage[]>(`/conversations/${e(id)}/search`, { query: { q, beforeSeq } }),
      markRead: (id: string, seq: number) => http.post<{ lastReadSeq: number }>(`/conversations/${e(id)}/read`, { seq }),
      mute: (id: string, muted: boolean, until?: string | null) => http.post<{ muted: boolean }>(`/conversations/${e(id)}/mute`, { muted, until }),
      openThread: (id: string, messageId: string) =>
        http.post<ConversationSummary>(`/conversations/${e(id)}/messages/${e(messageId)}/thread`),
    },

    realtime: {
      token: (input: { conversationIds: string[]; crewIds: string[] }) => http.post<RealtimeTokenResponse>('/realtime/token', input),
    },

    media: {
      sign: (input: MediaSignInput) => http.post<MediaSignResponse>('/media/sign', input),
      complete: (input: MediaCompleteInput) => http.post<UploadedMedia>('/media/complete', input),
      delete: (mediaId: string) => http.del<{ deleted: true }>(`/media/${e(mediaId)}`),
    },

    events: {
      list: (query: { crewId?: string; country?: string; scope?: 'upcoming' | 'past' | 'mine'; cursor?: string } = {}) =>
        paginated<EventSummary>(http, '/events', query),
      create: (input: EventCreateInput) => http.post<EventDetail>('/events', input),
      get: (id: string) => http.get<EventDetail>(`/events/${e(id)}`),
      update: (id: string, input: Partial<EventCreateInput> & { status?: 'scheduled' | 'cancelled'; announce?: boolean }) =>
        http.patch<EventDetail>(`/events/${e(id)}`, input),
      delete: (id: string) => http.del<{ deleted: true }>(`/events/${e(id)}`),
      rsvp: (id: string, status: 'going' | 'interested' | 'not_going') => http.post<EventDetail>(`/events/${e(id)}/rsvp`, { status }),
      attendees: (id: string) => http.get<EventAttendee[]>(`/events/${e(id)}/attendees`),
      icsUrl: (id: string) => `${options.baseUrl}/api/v1/events/${e(id)}/ics`,
    },

    notifications: {
      list: (cursor?: string) => paginated<NotificationItem>(http, '/notifications', { cursor }),
      unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),
      markRead: (input: { ids: string[] } | { all: true }) => http.post<{ updated: number }>('/notifications/read', input),
    },

    verification: {
      list: () => http.get<{ requests: VerificationRequestDto[]; results: VerificationResultDto[] }>('/verification'),
      start: (input: VerificationStartInput) => http.post<VerificationRequestDto>('/verification', input),
      get: (id: string) => http.get<VerificationRequestDto>(`/verification/${e(id)}`),
      uploadUrl: (id: string, input: { mime: string; size: number }) =>
        http.post<PrivateUploadResponse>(`/verification/${e(id)}/evidence`, input),
      completeUpload: (id: string, evidenceId: string) =>
        http.post<VerificationRequestDto>(`/verification/${e(id)}/evidence/complete`, { evidenceId }),
      submit: (id: string) => http.post<VerificationRequestDto>(`/verification/${e(id)}/submit`),
      cancel: (id: string) => http.del<VerificationRequestDto>(`/verification/${e(id)}`),
      queue: (status: 'pending_review' | 'in_review' = 'pending_review') =>
        http.get<VerificationReviewItem[]>('/admin/verification', { query: { status } }),
      claim: (id: string) => http.post<VerificationReviewItem>(`/admin/verification/${e(id)}/claim`),
      evidenceUrl: (id: string, evidenceId: string) =>
        http.get<{ url: string; expiresAt: string }>(`/admin/verification/${e(id)}/evidence/${e(evidenceId)}`),
      review: (id: string, input: { decision: 'approve' | 'reject'; reason?: string | null }) =>
        http.post<VerificationReviewItem>(`/admin/verification/${e(id)}/review`, input),
    },

    reports: {
      create: (input: ReportCreateInput) => http.post<{ id: string }>('/reports', input),
      resolveCrew: (crewId: string, reportId: string, input: { status: 'reviewing' | 'actioned' | 'dismissed'; resolution?: string | null; removeContent?: boolean }) =>
        http.post<ReportDto>(`/crews/id/${e(crewId)}/reports/${e(reportId)}`, input),
    },

    appeals: {
      create: (input: { moderationActionId: string; message: string }) => http.post<AppealDto>('/appeals', input),
      mine: () => http.get<AppealDto[]>('/appeals'),
    },

    themes: {
      list: (query: { q?: string; sort?: 'popular' | 'new' | 'rating'; cursor?: string } = {}) =>
        paginated<ThemeListing>(http, '/themes', query),
      get: (slug: string) => http.get<ThemeListingDetail>(`/themes/${e(slug)}`),
      publish: (input: { crewId: string; name: string; description?: string | null; tags?: string[] }) =>
        http.post<ThemeListing>('/themes', input),
      rate: (slug: string, rating: number) => http.post<ThemeListing>(`/themes/${e(slug)}/rating`, { rating }),
      install: (slug: string, crewId: string, mode: ThemeInstallMode) =>
        http.post<CrewThemeState>(`/themes/${e(slug)}/install`, { crewId, mode }),
    },

    admin: {
      stats: () => http.get<AdminStats>('/admin/stats'),
      health: () => http.get<SystemHealth>('/admin/health'),
      reports: (status: 'open' | 'reviewing' | 'actioned' | 'dismissed' = 'open', cursor?: string) =>
        paginated<ReportDto>(http, '/admin/reports', { status, cursor }),
      resolveReport: (id: string, input: { status: 'reviewing' | 'actioned' | 'dismissed'; resolution?: string | null; removeContent?: boolean }) =>
        http.post<ReportDto>(`/admin/reports/${e(id)}`, input),
      users: (query: { q?: string; status?: string; cursor?: string } = {}) =>
        paginated<UserSummary & { status: string; platformRole: string; createdAt: string }>(http, '/admin/users', query),
      suspend: (userId: string, input: { reason: string; until?: string | null }) =>
        http.post<{ ok: true }>(`/admin/users/${e(userId)}/suspend`, input),
      unsuspend: (userId: string) => http.del<{ ok: true }>(`/admin/users/${e(userId)}/suspend`),
      crews: (query: { q?: string; cursor?: string } = {}) => paginated<CrewSummary & { ownerId: string }>(http, '/admin/crews', query),
      themes: (status: 'pending' | 'approved' | 'rejected' = 'pending') => http.get<ThemeListing[]>('/admin/themes', { query: { status } }),
      reviewTheme: (id: string, input: { decision: 'approve' | 'reject'; note?: string | null }) =>
        http.post<ThemeListing>(`/admin/themes/${e(id)}`, input),
      appeals: () => http.get<AppealDto[]>('/admin/appeals'),
      decideAppeal: (id: string, input: { decision: 'upheld' | 'overturned'; note?: string | null }) =>
        http.post<AppealDto>(`/admin/appeals/${e(id)}`, input),
      auditLog: (cursor?: string) => paginated<AuditLogEntry>(http, '/admin/audit-log', { cursor }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
