import 'server-only';
import { getEnv } from '../env';
import { log } from '../log';

/**
 * Expo Push Service (managed delivery to APNs / FCM). Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 * EXPO_ACCESS_TOKEN is optional unless "enhanced push security" is enabled for the Expo project.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

let sender: ((messages: PushMessage[]) => Promise<PushTicket[]>) | null = null;
export function setPushSenderForTests(fn: typeof sender): void {
  sender = fn;
}

export async function sendPush(messages: PushMessage[]): Promise<PushTicket[]> {
  if (!messages.length || !getEnv().FEATURE_PUSH) return [];
  if (sender) return sender(messages);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const token = getEnv().EXPO_ACCESS_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const tickets: PushTicket[] = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers, body: JSON.stringify(chunk) });
      const json = (await res.json()) as { data?: PushTicket[] };
      tickets.push(...(json.data ?? []));
    } catch (error) {
      log.warn('expo push request failed', { error });
    }
  }
  return tickets;
}
