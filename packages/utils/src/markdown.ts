/**
 * Minimal, safe markdown parser for chat messages, bios and rich-text widgets.
 *
 * Produces a small AST that renderers (React DOM / React Native) map to native elements. No HTML is ever
 * produced or interpreted, so there is nothing to sanitize downstream: unknown syntax is plain text.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'strike'; children: InlineNode[] }
  | { type: 'spoiler'; children: InlineNode[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'mention'; kind: 'user' | 'role' | 'channel'; id: string }
  | { type: 'mentionAll'; kind: 'everyone' | 'here' }
  | { type: 'break' };

export type BlockNode =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'quote'; children: InlineNode[] }
  | { type: 'codeBlock'; language: string | null; value: string }
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] };

export interface ParseOptions {
  /** Allow headings and lists (rich-text widgets / bios). Chat keeps a flatter subset. */
  blocks?: boolean;
  /** Maximum input length processed; the rest is cut. */
  maxLength?: number;
}

const URL_RE = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/i;

/** Only http(s) and mailto links are ever produced. */
export function safeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch {
      return null;
    }
  }
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(trimmed)) return trimmed;
  return null;
}

interface Delimited {
  open: string;
  close: string;
  type: 'bold' | 'italic' | 'strike' | 'spoiler';
}

const DELIMITERS: Delimited[] = [
  { open: '**', close: '**', type: 'bold' },
  { open: '~~', close: '~~', type: 'strike' },
  { open: '||', close: '||', type: 'spoiler' },
  { open: '*', close: '*', type: 'italic' },
  { open: '_', close: '_', type: 'italic' },
];

function pushText(nodes: InlineNode[], value: string) {
  if (!value) return;
  const last = nodes[nodes.length - 1];
  if (last && last.type === 'text') last.value += value;
  else nodes.push({ type: 'text', value });
}

export function parseInline(input: string, depth = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;
  while (i < input.length) {
    const rest = input.slice(i);
    const ch = input[i]!;

    if (ch === '\n') {
      nodes.push({ type: 'break' });
      i += 1;
      continue;
    }

    if (ch === '\\' && i + 1 < input.length) {
      pushText(nodes, input[i + 1]!);
      i += 2;
      continue;
    }

    if (ch === '`') {
      const end = input.indexOf('`', i + 1);
      if (end > i + 1) {
        nodes.push({ type: 'code', value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (ch === '<') {
      const m = /^<(@&|@|#)([a-f0-9]{24})>/.exec(rest);
      if (m) {
        const kind = m[1] === '@' ? 'user' : m[1] === '@&' ? 'role' : 'channel';
        nodes.push({ type: 'mention', kind, id: m[2]! });
        i += m[0].length;
        continue;
      }
    }

    if (ch === '@') {
      const m = /^@(everyone|here)\b/.exec(rest);
      if (m) {
        nodes.push({ type: 'mentionAll', kind: m[1] as 'everyone' | 'here' });
        i += m[0].length;
        continue;
      }
    }

    if (ch === '[' && depth < 3) {
      const m = /^\[([^\]\n]{1,300})\]\(([^)\s]{1,2048})\)/.exec(rest);
      if (m) {
        const href = safeHref(m[2]!);
        if (href) {
          nodes.push({ type: 'link', href, children: parseInline(m[1]!, depth + 1) });
          i += m[0].length;
          continue;
        }
      }
    }

    if ((ch === 'h' || ch === 'H') && /^https?:\/\//i.test(rest)) {
      const m = URL_RE.exec(rest);
      if (m) {
        const href = safeHref(m[0]);
        if (href) {
          nodes.push({ type: 'link', href, children: [{ type: 'text', value: m[0] }] });
          i += m[0].length;
          continue;
        }
      }
    }

    if (depth < 4) {
      let matched = false;
      for (const d of DELIMITERS) {
        if (!rest.startsWith(d.open)) continue;
        const start = i + d.open.length;
        const end = input.indexOf(d.close, start);
        // Require non-empty content and no leading space (avoids "2 * 3 * 4" turning italic).
        if (end > start && input[start] !== ' ' && input[end - 1] !== ' ') {
          const inner = input.slice(start, end);
          if (!inner.includes('\n\n')) {
            nodes.push({ type: d.type, children: parseInline(inner, depth + 1) });
            i = end + d.close.length;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;
    }

    pushText(nodes, ch);
    i += 1;
  }
  return nodes;
}

export function parseMarkdown(input: string, options: ParseOptions = {}): BlockNode[] {
  const max = options.maxLength ?? 20_000;
  const text = input.length > max ? input.slice(0, max) : input;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
      paragraph = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx]!;

    const fence = /^```([a-zA-Z0-9_+-]{0,20})\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      let j = idx + 1;
      while (j < lines.length && !/^```\s*$/.test(lines[j]!)) {
        body.push(lines[j]!);
        j++;
      }
      if (j < lines.length) {
        flushParagraph();
        blocks.push({ type: 'codeBlock', language: fence[1] || null, value: body.join('\n') });
        idx = j;
        continue;
      }
    }

    if (/^>\s?/.test(line)) {
      flushParagraph();
      const quoted: string[] = [];
      let j = idx;
      while (j < lines.length && /^>\s?/.test(lines[j]!)) {
        quoted.push(lines[j]!.replace(/^>\s?/, ''));
        j++;
      }
      blocks.push({ type: 'quote', children: parseInline(quoted.join('\n')) });
      idx = j - 1;
      continue;
    }

    if (options.blocks) {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph();
        blocks.push({
          type: 'heading',
          level: heading[1]!.length as 1 | 2 | 3,
          children: parseInline(heading[2]!),
        });
        continue;
      }
      const listMatch = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(line);
      if (listMatch) {
        flushParagraph();
        const ordered = /\d+\./.test(listMatch[2]!);
        const items: InlineNode[][] = [];
        let j = idx;
        while (j < lines.length) {
          const m = /^(\s*)([-*]|\d+\.)\s+(.+)$/.exec(lines[j]!);
          if (!m || /\d+\./.test(m[2]!) !== ordered) break;
          items.push(parseInline(m[3]!));
          j++;
        }
        blocks.push({ type: 'list', ordered, items });
        idx = j - 1;
        continue;
      }
    }

    if (line.trim() === '') {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

/** Collect mention ids from a message body (used server-side to store mention metadata). */
export function extractMentions(input: string): {
  userIds: string[];
  roleIds: string[];
  channelIds: string[];
  everyone: boolean;
  here: boolean;
} {
  const userIds = new Set<string>();
  const roleIds = new Set<string>();
  const channelIds = new Set<string>();
  for (const m of input.matchAll(/<(@&|@|#)([a-f0-9]{24})>/g)) {
    if (m[1] === '@') userIds.add(m[2]!);
    else if (m[1] === '@&') roleIds.add(m[2]!);
    else channelIds.add(m[2]!);
  }
  return {
    userIds: [...userIds].slice(0, 50),
    roleIds: [...roleIds].slice(0, 20),
    channelIds: [...channelIds].slice(0, 20),
    everyone: /(^|\s)@everyone\b/.test(input),
    here: /(^|\s)@here\b/.test(input),
  };
}

/** Plain-text projection (notifications, previews, search snippets). */
export function toPlainText(nodes: InlineNode[] | BlockNode[]): string {
  const out: string[] = [];
  const walkInline = (n: InlineNode) => {
    switch (n.type) {
      case 'text':
      case 'code':
        out.push(n.value);
        break;
      case 'break':
        out.push(' ');
        break;
      case 'mention':
        out.push(n.kind === 'channel' ? '#channel' : '@mention');
        break;
      case 'mentionAll':
        out.push(`@${n.kind}`);
        break;
      case 'spoiler':
        out.push('▒▒▒');
        break;
      default:
        n.children.forEach(walkInline);
    }
  };
  for (const node of nodes) {
    if ('children' in node && node.type !== 'link' && ['paragraph', 'quote', 'heading'].includes(node.type)) {
      (node.children as InlineNode[]).forEach(walkInline);
      out.push(' ');
    } else if (node.type === 'codeBlock') {
      out.push(node.value, ' ');
    } else if (node.type === 'list') {
      node.items.forEach((item) => {
        item.forEach(walkInline);
        out.push(' ');
      });
    } else {
      walkInline(node as InlineNode);
    }
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}
