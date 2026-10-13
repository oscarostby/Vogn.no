'use client';

import type * as AblyTypes from 'ably';
import { type ConversationEvent, realtimeChannels, type TypingSignal, type UserEvent } from '@vogn/types';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';

export type RealtimeStatus = 'disabled' | 'initializing' | 'connecting' | 'connected' | 'disconnected' | 'suspended' | 'failed';

interface Interest {
  conversations: Map<string, number>;
  crews: Map<string, number>;
}

interface RealtimeContextValue {
  status: RealtimeStatus;
  userId: string | null;
  getClient: () => AblyTypes.Realtime | null;
  addInterest: (kind: 'conversations' | 'crews', id: string) => () => void;
  onReconnect: (fn: () => void) => () => void;
  /** Resolves once the current token includes the requested channels. */
  ready: () => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

/**
 * Manages one Ably connection per tab. Tokens are minted by our API for the exact set of conversations
 * and crews currently on screen (capability-scoped), and refreshed whenever that interest set changes.
 * When realtime is not configured the provider reports `disabled` and callers fall back to polling.
 */
export function RealtimeProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>(userId ? 'initializing' : 'disabled');
  const clientRef = useRef<AblyTypes.Realtime | null>(null);
  const interest = useRef<Interest>({ conversations: new Map(), crews: new Map() });
  const reconnectListeners = useRef(new Set<() => void>());
  const authorizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authorizing = useRef<Promise<void>>(Promise.resolve());
  const wasDisconnected = useRef(false);

  const tokenInput = () => ({
    conversationIds: [...interest.current.conversations.keys()].slice(-40),
    crewIds: [...interest.current.crews.keys()].slice(-10),
  });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let client: AblyTypes.Realtime | null = null;
    (async () => {
      const probe = await api.realtime.token(tokenInput()).catch(() => null);
      if (cancelled) return;
      if (!probe?.configured || !probe.tokenRequest) {
        setStatus('disabled');
        return;
      }
      const Ably = await import('ably');
      if (cancelled) return;
      let first: AblyTypes.TokenRequest | null = probe.tokenRequest as unknown as AblyTypes.TokenRequest;
      client = new Ably.Realtime({
        authCallback: (_params, callback) => {
          if (first) {
            const t = first;
            first = null;
            callback(null, t);
            return;
          }
          api.realtime
            .token(tokenInput())
            .then((res) => {
              if (!res.tokenRequest) callback('Realtime is not configured', null);
              else callback(null, res.tokenRequest as unknown as AblyTypes.TokenRequest);
            })
            .catch((error: unknown) => callback(error instanceof Error ? error.message : 'token error', null));
        },
        closeOnUnload: true,
        transportParams: { remainPresentFor: '2000' },
      });
      clientRef.current = client;
      client.connection.on((change) => {
        setStatus(change.current as RealtimeStatus);
        if (change.current === 'disconnected' || change.current === 'suspended') wasDisconnected.current = true;
        if (change.current === 'connected' && wasDisconnected.current) {
          wasDisconnected.current = false;
          reconnectListeners.current.forEach((fn) => fn());
        }
      });
    })();
    return () => {
      cancelled = true;
      client?.close();
      clientRef.current = null;
    };
  }, [userId]);

  const scheduleAuthorize = useCallback(() => {
    if (authorizeTimer.current) clearTimeout(authorizeTimer.current);
    authorizeTimer.current = setTimeout(() => {
      const client = clientRef.current;
      if (!client) return;
      authorizing.current = client.auth
        .authorize()
        .then(() => undefined)
        .catch(() => undefined);
    }, 60);
  }, []);

  const addInterest = useCallback(
    (kind: 'conversations' | 'crews', id: string) => {
      const map = interest.current[kind];
      const isNew = !map.has(id);
      map.set(id, (map.get(id) ?? 0) + 1);
      if (isNew) scheduleAuthorize();
      return () => {
        const n = (map.get(id) ?? 1) - 1;
        if (n <= 0) map.delete(id);
        else map.set(id, n);
      };
    },
    [scheduleAuthorize],
  );

  const onReconnect = useCallback((fn: () => void) => {
    reconnectListeners.current.add(fn);
    return () => {
      reconnectListeners.current.delete(fn);
    };
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      userId,
      getClient: () => clientRef.current,
      addInterest,
      onReconnect,
      ready: () => new Promise<void>((resolve) => setTimeout(() => authorizing.current.then(resolve), 80)),
    }),
    [status, userId, addInterest, onReconnect],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    return {
      status: 'disabled',
      userId: null,
      getClient: () => null,
      addInterest: () => () => undefined,
      onReconnect: () => () => undefined,
      ready: () => Promise.resolve(),
    };
  }
  return ctx;
}

/** Subscribes to authoritative events for a conversation (`conv:{id}`). */
export function useConversationEvents(conversationId: string | null, handler: (event: ConversationEvent) => void) {
  const { status, getClient, addInterest, ready } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const live = status === 'connected' || status === 'connecting' || status === 'disconnected';
  useEffect(() => {
    if (!conversationId || !live) return;
    const release = addInterest('conversations', conversationId);
    let channel: AblyTypes.RealtimeChannel | null = null;
    let disposed = false;
    const listener = (msg: AblyTypes.InboundMessage) => handlerRef.current(msg.data as ConversationEvent);
    void ready().then(() => {
      const client = getClient();
      if (disposed || !client) return;
      channel = client.channels.get(realtimeChannels.conversation(conversationId));
      void channel.subscribe(listener).catch(() => undefined);
    });
    return () => {
      disposed = true;
      channel?.unsubscribe(listener);
      void channel?.detach().catch(() => undefined);
      release();
    };
  }, [conversationId, live, addInterest, getClient, ready]);
}

/** Personal event stream (`user:{id}`): notifications, unread hints, membership changes. */
export function useUserEvents(handler: (event: UserEvent) => void) {
  const { status, getClient, userId } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!userId || status !== 'connected') return;
    const client = getClient();
    if (!client) return;
    const channel = client.channels.get(realtimeChannels.user(userId));
    const listener = (msg: AblyTypes.InboundMessage) => handlerRef.current(msg.data as UserEvent);
    void channel.subscribe(listener).catch(() => undefined);
    return () => channel.unsubscribe(listener);
  }, [status, userId, getClient]);
}

/** Ephemeral typing indicators on `conv:{id}:typing`. Returns typers and a throttled `notifyTyping`. */
export function useTyping(conversationId: string | null, displayName: string) {
  const { status, getClient, userId, ready } = useRealtime();
  const [typers, setTypers] = useState<Record<string, { name: string; at: number }>>({});
  const lastSent = useRef(0);
  const channelRef = useRef<AblyTypes.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId || status !== 'connected') return;
    let disposed = false;
    const listener = (msg: AblyTypes.InboundMessage) => {
      const data = msg.data as TypingSignal;
      // clientId is enforced by the token, so it cannot be spoofed by other clients.
      const from = msg.clientId;
      if (!from || from === userId) return;
      setTypers((prev) => {
        const next = { ...prev };
        if (data?.typing) next[from] = { name: String(data.displayName ?? '').slice(0, 40), at: Date.now() };
        else delete next[from];
        return next;
      });
    };
    void ready().then(() => {
      const client = getClient();
      if (disposed || !client) return;
      const channel = client.channels.get(realtimeChannels.typing(conversationId));
      channelRef.current = channel;
      void channel.subscribe('typing', listener).catch(() => undefined);
    });
    const sweep = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => now - v.at < 6000));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(sweep);
      channelRef.current?.unsubscribe('typing', listener);
      channelRef.current = null;
      setTypers({});
    };
  }, [conversationId, status, getClient, userId, ready]);

  const notifyTyping = useCallback(
    (typing: boolean) => {
      const channel = channelRef.current;
      if (!channel || !userId) return;
      const now = Date.now();
      if (typing && now - lastSent.current < 3000) return;
      lastSent.current = typing ? now : 0;
      const signal: TypingSignal = { userId, displayName, typing };
      void channel.publish('typing', signal).catch(() => undefined);
    },
    [userId, displayName],
  );

  return { typers: Object.values(typers).map((t) => t.name), notifyTyping };
}

/** Online members of a crew via Ably presence (only users whose privacy settings allow it enter). */
export function useCrewPresence(crewId: string | null, enter: boolean) {
  const { status, getClient, addInterest, ready } = useRealtime();
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!crewId || status !== 'connected') return;
    const release = addInterest('crews', crewId);
    let channel: AblyTypes.RealtimeChannel | null = null;
    let disposed = false;
    const refresh = async () => {
      if (!channel) return;
      const members = await channel.presence.get().catch(() => []);
      if (!disposed) setOnline(new Set(members.map((m) => m.clientId).filter(Boolean) as string[]));
    };
    void ready().then(async () => {
      const client = getClient();
      if (disposed || !client) return;
      channel = client.channels.get(realtimeChannels.crewPresence(crewId));
      await channel.presence.subscribe(() => void refresh()).catch(() => undefined);
      if (enter) await channel.presence.enter().catch(() => undefined);
      await refresh();
    });
    return () => {
      disposed = true;
      if (channel) {
        channel.presence.unsubscribe();
        if (enter) void channel.presence.leave().catch(() => undefined);
      }
      release();
    };
  }, [crewId, status, enter, addInterest, getClient, ready]);
  return online;
}
