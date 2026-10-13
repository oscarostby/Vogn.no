// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChatMessage } from '@vogn/types';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPanel } from './chat-panel';

const requests = vi.hoisted(() => ({ messages: vi.fn(), sync: vi.fn(), send: vi.fn(), markRead: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { conversations: requests }, queryKeys: { conversations: ['conversations'], myCrews: ['crews'], home: ['home'] } }));
vi.mock('@/lib/hooks', () => ({ useProfile: () => ({ id: 'me', displayName: 'Me' }) }));
vi.mock('@/lib/realtime/provider', () => {
  const realtime = { status: 'disabled', onReconnect: () => () => undefined };
  return { useRealtime: () => realtime, useConversationEvents: () => undefined, useTyping: () => ({ typers: [], notifyTyping: () => undefined }) };
});
vi.mock('@/components/app/media-uploader', () => ({ MediaUploader: () => null }));

const timestamp = '2026-10-13T12:00:00.000Z';
function message(seq: number, content = `Message ${seq}`, updatedAt = timestamp): ChatMessage {
  return { id: `message-${seq}`, conversationId: 'conversation', seq, sender: null, type: 'default', content, mentions: { userIds: [], roleIds: [], everyone: false }, attachments: [], embeds: [], replyTo: null, thread: null, reactions: [], pinned: false, createdAt: timestamp, updatedAt, editedAt: null, deletedAt: null, idempotencyKey: null };
}

function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><NextIntlClientProvider locale="en" messages={{ errors: { INTERNAL: 'The request failed.' }, common: { retry: 'Retry' } }}><ChatPanel conversationId="conversation" canUpload={false} /></NextIntlClientProvider></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  requests.messages.mockResolvedValue([message(1)]);
  requests.sync.mockResolvedValue({ messages: [], updated: [], lastSeq: 1, serverTime: timestamp });
  requests.markRead.mockResolvedValue({ lastReadSeq: 1 });
});
afterEach(cleanup);

describe('chat persistence and catch-up', () => {
  it('keeps the draft after a failed send and reuses its idempotency key on retry', async () => {
    requests.send.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce(message(2, 'Keep this draft'));
    mount();
    await screen.findByText('Message 1');
    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('The request failed.');
    expect((input as HTMLTextAreaElement).value).toBe('Keep this draft');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Keep this draft');
    expect(requests.send.mock.calls[0]?.[1].idempotencyKey).toBe(requests.send.mock.calls[1]?.[1].idempotencyKey);
    expect((input as HTMLTextAreaElement).value).toBe('');
  });

  it('drains truncated catch-up batches without jumping past messages', async () => {
    requests.sync.mockReset().mockResolvedValueOnce({ messages: Array.from({ length: 100 }, (_, index) => message(index + 2)), updated: [], lastSeq: 201, serverTime: timestamp }).mockResolvedValueOnce({ messages: Array.from({ length: 100 }, (_, index) => message(index + 102)), updated: [], lastSeq: 201, serverTime: timestamp });
    mount();
    await screen.findByText('Message 201');
    expect(requests.sync.mock.calls[0]?.[1].afterSeq).toBe(1);
    expect(requests.sync.mock.calls[1]?.[1].afterSeq).toBe(101);
    expect(screen.getByText('Message 101')).toBeTruthy();
    expect(screen.getByText('Message 102')).toBeTruthy();
  });

  it('reconciles edits and deletion when live delivery is disabled', async () => {
    mount();
    await screen.findByText('Message 1');
    await waitFor(() => expect(requests.sync).toHaveBeenCalledTimes(1));
    const edited = { ...message(1, 'Edited on another device', '2026-10-13T12:01:00.000Z'), editedAt: '2026-10-13T12:01:00.000Z' };
    requests.sync.mockResolvedValueOnce({ messages: [], updated: [edited], lastSeq: 1, serverTime: '2026-10-13T12:01:00.000Z' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('Edited on another device');
    expect(screen.queryByText('Message 1')).toBeNull();
    requests.sync.mockResolvedValueOnce({ messages: [], updated: [{ ...edited, content: '', deletedAt: '2026-10-13T12:02:00.000Z', updatedAt: '2026-10-13T12:02:00.000Z' }], lastSeq: 1, serverTime: '2026-10-13T12:02:00.000Z' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('Message deleted');
    expect(screen.queryByText('Edited on another device')).toBeNull();
  });
});
