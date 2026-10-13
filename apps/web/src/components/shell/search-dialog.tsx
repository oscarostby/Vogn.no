'use client';

import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Car, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/display';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useDebounced } from '@/lib/hooks';

export function useSearchShortcut(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations('common');
  const router = useRouter();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 200);
  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search(debounced),
    enabled: open && debounced.length >= 1,
    staleTime: 30_000,
  });
  const go = (href: string) => {
    onOpenChange(false);
    setQ('');
    router.push(href);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" hideClose className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0">
        <Command shouldFilter={false} label={t('search')} className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-4 text-muted" aria-hidden="true" />
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder={t('searchPlaceholder')}
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
            />
            {isFetching && <span className="text-xs text-subtle">…</span>}
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {debounced && !isFetching && <Command.Empty className="px-3 py-8 text-center text-sm text-muted">{t('empty')}</Command.Empty>}
            {data?.crews.length ? (
              <Command.Group heading="Crews" className="px-1 py-1 text-xs text-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {data.crews.map((c) => (
                  <Command.Item key={c.id} value={`crew-${c.id}`} onSelect={() => go(`/c/${c.slug}`)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated">
                    <Avatar name={c.name} image={c.icon} size="sm" shape="rounded" accent={c.accentColor} />
                    <span className="grid">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted">{c.memberCount} members</span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {data?.users.length ? (
              <Command.Group heading="People" className="px-1 py-1 text-xs text-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {data.users.map((u) => (
                  <Command.Item key={u.id} value={`user-${u.id}`} onSelect={() => go(`/u/${u.username}`)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated">
                    <Avatar name={u.displayName} image={u.avatar} size="sm" accent={u.accentColor} />
                    <span className="grid">
                      <span className="font-medium">{u.displayName}</span>
                      <span className="text-xs text-muted">@{u.username}</span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {data?.vehicles.length ? (
              <Command.Group heading="Builds" className="px-1 py-1 text-xs text-subtle [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {data.vehicles.map((v) => (
                  <Command.Item key={v.id} value={`vehicle-${v.id}`} onSelect={() => go(`/v/${v.id}`)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-fg data-[selected=true]:bg-elevated">
                    <span className="flex size-7 items-center justify-center rounded-md bg-elevated text-muted">
                      <Car className="size-4" aria-hidden="true" />
                    </span>
                    <span className="grid">
                      <span className="font-medium">
                        {v.year ? `${v.year} ` : ''}
                        {v.make} {v.model}
                      </span>
                      <span className="text-xs text-muted">@{v.owner.username}</span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {!debounced && (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted">
                <Users className="size-4" aria-hidden="true" /> Search crews, people and builds.
              </div>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
