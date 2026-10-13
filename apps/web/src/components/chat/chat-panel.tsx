'use client';

import { isApiError, type UploadedMedia } from '@vogn/api-client';
import type { ChatMessage } from '@vogn/types';
import { MESSAGE_MAX_LENGTH } from '@vogn/validation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, Check, Pencil, Reply, Send, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaUploader } from '@/components/app/media-uploader';
import { Markdown } from '@/components/content/markdown';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/display';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { useProfile } from '@/lib/hooks';
import { useConversationEvents, useRealtime, useTyping } from '@/lib/realtime/provider';

function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    const existing = byId.get(message.id);
    if (!existing || message.updatedAt >= existing.updatedAt) byId.set(message.id, message);
  }
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

/** MongoDB sync remains authoritative, including when live delivery is unavailable. */
export function ChatPanel({ conversationId, canSend = true, canManage = false, canUpload = true }: { conversationId: string; canSend?: boolean; canManage?: boolean; canUpload?: boolean }) {
  const me = useProfile();
  const qc = useQueryClient();
  const realtime = useRealtime();
  const { onReconnect } = realtime;
  const status = useRef(realtime.status);
  useEffect(() => { status.current = realtime.status; }, [realtime.status]);
  const { typers, notifyTyping } = useTyping(conversationId, me?.displayName ?? 'Member');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [older, setOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [attachments, setAttachments] = useState<UploadedMedia[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [retry, setRetry] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const scrollToBottom = useRef(true);
  const synchronize = useRef<() => void>(() => undefined);
  const pendingSend = useRef<{ fingerprint: string; key: string } | null>(null);
  const readSeq = useRef(-1);

  const merge = useCallback((incoming: ChatMessage[]) => setMessages((prev) => mergeMessages(prev, incoming)), []);

  useConversationEvents(conversationId, () => synchronize.current());

  useEffect(() => {
    let active = true;
    let busy = false;
    let initialized = false;
    let afterSeq = 0;
    let updatedSince: string | undefined;
    let timer: ReturnType<typeof setTimeout>;
    readSeq.current = -1;

    const sync = async () => {
      if (!active || busy) return;
      busy = true;
      try {
        if (!initialized) {
          const initial = await api.conversations.messages(conversationId, { limit: 50 });
          if (!active) return;
          merge(initial);
          setOlder(initial.length === 50);
          afterSeq = initial.reduce((max, message) => Math.max(max, message.seq), 0);
          // Start with an overlap of known timestamps instead of the browser clock.
          updatedSince = initial.length ? new Date(Math.min(...initial.map((message) => Date.parse(message.updatedAt))) - 1).toISOString() : undefined;
          initialized = true;
        }
        let pages = 0;
        let more = true;
        while (active && more && pages++ < 10) {
          const result = await api.conversations.sync(conversationId, { afterSeq, updatedSince, limit: 100 });
          if (!active) return;
          merge([...result.messages, ...result.updated]);
          afterSeq = result.messages.reduce((max, message) => Math.max(max, message.seq), afterSeq);
          // A batch can be truncated: never advance to result.lastSeq until those messages arrive.
          more = result.messages.length === 100 && afterSeq < result.lastSeq;
          if (result.updated.length < 200) {
            // The overlap catches updates committed while the server was reading its two batches.
            updatedSince = new Date(Date.parse(result.serverTime) - 30_000).toISOString();
          } else {
            updatedSince = new Date(Date.parse(result.updated[result.updated.length - 1]!.updatedAt) - 1).toISOString();
          }
        }
        setError(null);
        if (document.visibilityState === 'visible' && afterSeq > readSeq.current) {
          const result = await api.conversations.markRead(conversationId, afterSeq);
          if (!active) return;
          readSeq.current = result.lastReadSeq;
          void qc.invalidateQueries({ queryKey: queryKeys.conversations });
          void qc.invalidateQueries({ queryKey: queryKeys.myCrews });
          void qc.invalidateQueries({ queryKey: queryKeys.home });
        }
      } catch (cause) {
        if (active) setError(cause);
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    };
    const poll = async () => { await sync(); if (active) timer = setTimeout(() => void poll(), status.current === 'connected' ? 15_000 : 3_000); };
    synchronize.current = () => void sync();
    const resume = () => { if (document.visibilityState === 'visible') void sync(); };
    const reconnect = onReconnect(() => void sync());
    window.addEventListener('online', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    void poll();
    return () => { active = false; clearTimeout(timer); reconnect(); window.removeEventListener('online', resume); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); synchronize.current = () => undefined; };
  }, [conversationId, merge, qc, onReconnect, retry]);

  useEffect(() => {
    const element = scroller.current;
    if (element && scrollToBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  const loadOlder = async () => {
    if (!messages[0] || loadingOlder) return;
    setLoadingOlder(true); setActionError(null);
    const height = scroller.current?.scrollHeight ?? 0;
    scrollToBottom.current = false;
    try {
      const batch = await api.conversations.messages(conversationId, { before: messages[0].seq, limit: 50 });
      merge(batch); setOlder(batch.length === 50);
      requestAnimationFrame(() => { if (scroller.current) scroller.current.scrollTop += scroller.current.scrollHeight - height; });
    } catch (cause) { setActionError(cause); }
    finally { setLoadingOlder(false); }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending || !canSend || (!content.trim() && !attachments.length)) return;
    const fingerprint = JSON.stringify({ content: content.trim(), reply: reply?.id, attachments: attachments.map((media) => media.id) });
    if (!pendingSend.current || pendingSend.current.fingerprint !== fingerprint) pendingSend.current = { fingerprint, key: crypto.randomUUID() };
    setSending(true); setActionError(null);
    try {
      const saved = await api.conversations.send(conversationId, { content: content.trim(), attachmentIds: attachments.map((media) => media.id), replyToId: reply?.id ?? null, idempotencyKey: pendingSend.current.key });
      scrollToBottom.current = true; merge([saved]);
      setContent(''); setReply(null); setAttachments([]); pendingSend.current = null; notifyTyping(false); synchronize.current();
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
    } catch (cause) { setActionError(cause); }
    finally { setSending(false); }
  };

  const perform = async (action: () => Promise<ChatMessage>) => {
    setActionError(null);
    try { merge([await action()]); return true; } catch (cause) { setActionError(cause); return false; }
  };

  if (loading && !messages.length) return <ListSkeleton className="p-5" rows={6} />;
  if (error && !messages.length) return <ErrorState error={error} onRetry={() => setRetry((n) => n + 1)} className="m-4" />;

  return <div className="flex h-[min(76dvh,820px)] min-h-[460px] flex-col">
    <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted"><span>{realtime.status === 'connected' ? 'Live updates connected' : 'Updates refresh automatically'}</span><Button size="xs" variant="ghost" onClick={() => synchronize.current()}>Refresh</Button></div>
    {Boolean(error) && <div role="status" className="bg-elevated px-4 py-2 text-xs text-warning">{isApiError(error) ? error.message : 'Connection interrupted. Retrying automatically.'}</div>}
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5" onScroll={(event) => { const element = event.currentTarget; scrollToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120; }}>
      {older && messages.length > 0 && <div className="mb-4 text-center"><Button size="sm" variant="ghost" loading={loadingOlder} onClick={() => void loadOlder()}>Load earlier messages</Button></div>}
      {!messages.length && <EmptyState title="Start the conversation" description="Messages are saved and available when you return." />}
      <div role="log" aria-label="Messages" className="grid gap-1">{messages.map((message) => <article key={message.id} id={`message-${message.seq}`} className="group flex gap-3 rounded-lg px-2 py-3 hover:bg-elevated/50">
        <Avatar name={message.sender?.displayName ?? 'Deleted account'} image={message.sender?.avatar} accent={message.sender?.accentColor} size="md" />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs"><Link href={message.sender ? `/u/${message.sender.username}` : '#'} className="text-sm font-semibold hover:underline">{message.sender?.displayName ?? 'Deleted account'}</Link><time dateTime={message.createdAt} className="text-subtle">{new Date(message.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</time>{message.editedAt && <span className="text-subtle">edited</span>}{message.pinned && <Badge>Pinned</Badge>}</div>
          {message.replyTo && <p className="truncate border-l-2 border-line-strong pl-2 text-xs text-muted">Reply to {message.replyTo.sender?.displayName ?? 'message'}: {message.replyTo.deleted ? 'Deleted message' : message.replyTo.preview}</p>}
          {message.deletedAt ? <p className="text-sm italic text-subtle">Message deleted</p> : editing === message.id ? <form onSubmit={(event) => { event.preventDefault(); setSavingEdit(true); void perform(() => api.conversations.edit(conversationId, message.id, editContent)).then((saved) => { setSavingEdit(false); if (saved) setEditing(null); }); }} className="grid gap-2"><Input aria-label="Edit message" maxLength={MESSAGE_MAX_LENGTH} value={editContent} onChange={(event) => setEditContent(event.target.value)} required /><div className="flex gap-2"><Button type="submit" size="xs" loading={savingEdit}><Check /> Save</Button><Button size="xs" variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button></div></form> : <>
            {message.content && <Markdown text={message.content} className="text-sm leading-relaxed" />}
            {message.attachments.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="block max-w-sm rounded-lg border border-line p-2 text-sm text-accent-text">{attachment.kind === 'image' ? <img src={attachment.thumbnailUrl ?? attachment.url} alt={attachment.name} loading="lazy" className="max-h-72 rounded object-contain" /> : attachment.name}</a>)}
            {message.embeds.map((embed, index) => <Link key={index} href={embed.url} className="rounded-lg border border-line p-3 text-sm"><strong>{embed.title}</strong>{embed.description && <p className="text-muted">{embed.description}</p>}</Link>)}
            <div className="flex flex-wrap items-center gap-1">
              {message.reactions.map((reaction) => <Button key={reaction.emoji} variant={reaction.me ? 'secondary' : 'ghost'} size="xs" onClick={() => void perform(() => reaction.me ? api.conversations.unreact(conversationId, message.id, reaction.emoji) : api.conversations.react(conversationId, message.id, reaction.emoji))}>{reaction.emoji} {reaction.count}</Button>)}
              <Button size="xs" variant="ghost" aria-label="Like message" onClick={() => void perform(() => message.reactions.find((reaction) => reaction.emoji === '👍')?.me ? api.conversations.unreact(conversationId, message.id, '👍') : api.conversations.react(conversationId, message.id, '👍'))}>👍</Button>
              {canSend && <Button size="xs" variant="ghost" onClick={() => setReply(message)}><Reply /> Reply</Button>}
              {me && message.sender?.id === me.id && <Button size="xs" variant="ghost" onClick={() => { setEditing(message.id); setEditContent(message.content); }}><Pencil /> Edit</Button>}
              {((me && message.sender?.id === me.id) || canManage) && <Button size="xs" variant="danger-ghost" onClick={() => { if (window.confirm('Delete this message?')) void perform(() => api.conversations.delete(conversationId, message.id)); }}><Trash2 /> Delete</Button>}
            </div>
          </>}
        </div>
      </article>)}</div>
    </div>
    <div className="border-t border-line p-3 md:p-4">
      {Boolean(actionError) && <div className="mb-3"><ErrorState error={actionError} /></div>}
      {typers.length > 0 && <p role="status" className="mb-2 text-xs text-muted">{typers.join(', ')} typing…</p>}
      {canSend ? <form onSubmit={(event) => void send(event)} className="grid gap-2">
        {reply && <div className="flex items-center gap-2 text-xs text-muted"><span className="flex-1 truncate">Replying to {reply.sender?.displayName}: {reply.content}</span><Button type="button" variant="ghost" size="icon-xs" aria-label="Cancel reply" onClick={() => setReply(null)}><X /></Button></div>}
        {attachments.length > 0 && <div className="flex flex-wrap gap-2">{attachments.map((attachment) => <Badge key={attachment.id}>{attachment.id.slice(-6)}<button type="button" aria-label="Remove attachment" disabled={sending} onClick={() => setAttachments((prev) => prev.filter((media) => media.id !== attachment.id))}><X className="size-3" /></button></Badge>)}</div>}
        <Textarea aria-label="Message" placeholder="Write a message…" maxLength={MESSAGE_MAX_LENGTH} disabled={sending} value={content} onChange={(event) => { setContent(event.target.value); notifyTyping(Boolean(event.target.value)); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(event); } }} className="min-h-20 resize-none" />
        <div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-[11px] text-subtle">Enter to send · Shift+Enter for a new line</span>{canUpload && attachments.length < 10 && !sending && <MediaUploader purpose="message" contextId={conversationId} label="Attach image" className="h-9 flex-row gap-1 rounded-lg border-solid px-3 py-1 text-xs [&_svg]:size-4" onUploaded={(media) => setAttachments((prev) => [...prev, media].slice(0, 10))} />}<Button type="button" size="icon-sm" variant="ghost" aria-label="Jump to latest message" onClick={() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }}><ArrowDown /></Button><Button type="submit" size="sm" loading={sending} disabled={!content.trim() && !attachments.length}><Send /> Send</Button></div>
      </form> : <p className="text-center text-sm text-muted">You have read access to this channel.</p>}
    </div>
  </div>;
}
