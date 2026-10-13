import { type BlockNode, type InlineNode, parseInline, parseMarkdown } from '@vogn/utils';
import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MentionResolver {
  user?: (id: string) => string | null;
  role?: (id: string) => { name: string; color: string | null } | null;
  channel?: (id: string) => string | null;
}

function Spoiler({ children }: { children: ReactNode }) {
  return (
    <span
      tabIndex={0}
      className="cursor-pointer rounded bg-fg/80 px-0.5 text-transparent transition-colors select-none focus:bg-elevated focus:text-inherit hover:bg-elevated hover:text-inherit"
    >
      {children}
    </span>
  );
}

function renderInline(nodes: InlineNode[], mentions: MentionResolver, keyPrefix = ''): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.value}</Fragment>;
      case 'break':
        return <br key={key} />;
      case 'bold':
        return <strong key={key} className="font-semibold">{renderInline(node.children, mentions, `${key}-`)}</strong>;
      case 'italic':
        return <em key={key}>{renderInline(node.children, mentions, `${key}-`)}</em>;
      case 'strike':
        return <s key={key}>{renderInline(node.children, mentions, `${key}-`)}</s>;
      case 'spoiler':
        return <Spoiler key={key}>{renderInline(node.children, mentions, `${key}-`)}</Spoiler>;
      case 'code':
        return (
          <code key={key} className="rounded bg-sunken px-1 py-0.5 font-mono text-[0.85em]">
            {node.value}
          </code>
        );
      case 'link':
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-accent-text underline-offset-2 hover:underline">
            {renderInline(node.children, mentions, `${key}-`)}
          </a>
        );
      case 'mention': {
        if (node.kind === 'user') {
          const name = mentions.user?.(node.id) ?? 'unknown';
          return (
            <span key={key} className="rounded bg-accent-muted px-1 font-medium text-accent-text">
              @{name}
            </span>
          );
        }
        if (node.kind === 'role') {
          const role = mentions.role?.(node.id);
          return (
            <span key={key} className="rounded px-1 font-medium" style={{ color: role?.color ?? undefined, background: role?.color ? `color-mix(in srgb, ${role.color} 16%, transparent)` : undefined }}>
              @{role?.name ?? 'role'}
            </span>
          );
        }
        return (
          <span key={key} className="rounded bg-elevated px-1 font-medium">
            #{mentions.channel?.(node.id) ?? 'channel'}
          </span>
        );
      }
      case 'mentionAll':
        return (
          <span key={key} className="rounded bg-[color-mix(in_srgb,var(--vogn-warning)_16%,transparent)] px-1 font-medium text-warning">
            @{node.kind}
          </span>
        );
      default:
        return null;
    }
  });
}

function renderBlock(block: BlockNode, i: number, mentions: MentionResolver): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return <p key={i}>{renderInline(block.children, mentions, `${i}-`)}</p>;
    case 'quote':
      return (
        <blockquote key={i} className="border-l-2 border-line-strong pl-3 text-muted">
          {renderInline(block.children, mentions, `${i}-`)}
        </blockquote>
      );
    case 'codeBlock':
      return (
        <pre key={i} className="overflow-x-auto rounded-lg border border-line bg-sunken p-3 font-mono text-[13px] leading-relaxed">
          <code>{block.value}</code>
        </pre>
      );
    case 'heading': {
      const Tag = (`h${block.level + 1}`) as 'h2' | 'h3' | 'h4';
      return (
        <Tag key={i} className={cn('ct-heading font-semibold', block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg')}>
          {renderInline(block.children, mentions, `${i}-`)}
        </Tag>
      );
    }
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={i} className={cn('grid gap-1 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item, mentions, `${i}-${j}-`)}</li>
          ))}
        </Tag>
      );
    }
    default:
      return null;
  }
}

/** Renders user content as safe markdown (no HTML is ever interpreted). */
export function Markdown({
  text,
  blocks = false,
  mentions = {},
  className,
}: {
  text: string;
  blocks?: boolean;
  mentions?: MentionResolver;
  className?: string;
}) {
  const ast = parseMarkdown(text, { blocks });
  return <div className={cn('grid gap-2 break-words', className)}>{ast.map((b, i) => renderBlock(b, i, mentions))}</div>;
}

export function InlineMarkdown({ text, mentions = {} }: { text: string; mentions?: MentionResolver }) {
  return <>{renderInline(parseInline(text), mentions)}</>;
}
