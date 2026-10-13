import 'server-only';
import { parseObjectId } from '@vogn/database';
import { realtimeChannels, type RealtimeTokenResponse } from '@vogn/types';
import type { AuthedContext } from '../context';
import { ablyConfigured, type Capability, createTokenRequest } from '../integrations/ably';
import { getConversationAccess } from './conversation-access';
import { getCrewAccess } from './crew-access';
import { getSettings } from './users';

/**
 * Mints a capability-scoped Ably token request for the caller:
 *  - `user:{id}`                 subscribe (personal events)
 *  - `conv:{id}`                 subscribe only — authoritative events are server-published
 *  - `conv:{id}:typing`          publish + subscribe, only where the user may post
 *  - `crew:{id}:presence`        subscribe, plus presence when online status may be shown
 * Access to every requested channel is re-checked; anything not permitted is silently dropped.
 */
export async function createRealtimeToken(ctx: AuthedContext, input: { conversationIds: string[]; crewIds: string[] }): Promise<RealtimeTokenResponse> {
  const clientId = ctx.actor.userId.toHexString();
  if (!ablyConfigured()) return { tokenRequest: null, clientId, channels: [], configured: false };

  const capability: Capability = { [realtimeChannels.user(clientId)]: ['subscribe'] };

  for (const raw of input.conversationIds.slice(0, 40)) {
    const id = parseObjectId(raw);
    if (!id) continue;
    const conv = await ctx.cols.conversations.findOne({ _id: id });
    if (!conv) continue;
    const access = await getConversationAccess(ctx, conv);
    if (!access.canView) continue;
    capability[realtimeChannels.conversation(raw)] = ['subscribe'];
    capability[realtimeChannels.typing(raw)] = access.canSend ? ['publish', 'subscribe'] : ['subscribe'];
  }

  if (input.crewIds.length) {
    const settings = await getSettings(ctx, ctx.actor.userId);
    const mayShowOnline = settings.onlineStatusVisibility === 'everyone' || settings.onlineStatusVisibility === 'crew_members';
    for (const raw of input.crewIds.slice(0, 10)) {
      const id = parseObjectId(raw);
      if (!id) continue;
      const access = await getCrewAccess(ctx, id).catch(() => null);
      if (!access?.member) continue;
      capability[realtimeChannels.crewPresence(raw)] = mayShowOnline ? ['presence', 'subscribe'] : ['subscribe'];
    }
  }

  const tokenRequest = await createTokenRequest(clientId, capability);
  return { tokenRequest: tokenRequest as unknown as Record<string, unknown>, clientId, channels: Object.keys(capability), configured: true };
}
