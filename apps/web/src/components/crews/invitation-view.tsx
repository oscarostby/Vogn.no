'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/display';
import { ErrorState, ListSkeleton } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';

export function InvitationView({ code }: { code: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const preview = useQuery({ queryKey: ['invitation', code], queryFn: () => api.invites.preview(code) });
  const accept = useMutation({ mutationFn: () => api.invites.accept(code), onSuccess: (crew) => { void qc.invalidateQueries({ queryKey: queryKeys.myCrews }); void qc.invalidateQueries({ queryKey: queryKeys.home }); router.push(`/c/${crew.slug}`); } });
  return <PageContainer width="narrow">{preview.isPending ? <ListSkeleton /> : preview.error || !preview.data ? <ErrorState error={preview.error} onRetry={() => void preview.refetch()} /> : <div className="mx-auto grid max-w-md justify-items-center gap-4 rounded-xl border border-line bg-surface p-8 text-center"><Avatar name={preview.data.crew.name} image={preview.data.crew.icon} size="xl" shape="rounded" /><p className="text-sm text-muted">{preview.data.inviter?.displayName ?? 'A member'} invited you to</p><h1 className="font-display text-2xl font-semibold">{preview.data.crew.name}</h1><p className="text-sm text-muted">{preview.data.crew.description}</p><p className="text-xs text-subtle">{preview.data.crew.memberCount} members{preview.data.expiresAt ? ` · Expires ${new Date(preview.data.expiresAt).toLocaleDateString()}` : ''}</p>{preview.data.alreadyMember ? <Button asChild><Link href={`/c/${preview.data.crew.slug}`}>Open crew</Link></Button> : preview.data.valid ? <Button loading={accept.isPending} onClick={() => accept.mutate()}>Accept invitation</Button> : <p role="alert" className="text-sm text-warning">This invitation has expired or has been used up.</p>}{accept.error && <ErrorState error={accept.error} />}</div>}</PageContainer>;
}
