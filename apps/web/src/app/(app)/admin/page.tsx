'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReportStatus } from '@vogn/types';
import { useState } from 'react';
import { PageContainer, SectionTitle } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/hooks';

export default function AdminPage() {
  const me = useProfile(), qc = useQueryClient();
  const [status, setStatus] = useState<ReportStatus>('open');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const allowed = Boolean(me && ['admin', 'moderator'].includes(me.platformRole));
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => api.admin.stats(), enabled: allowed });
  const reports = useQuery({ queryKey: ['admin-reports', status], queryFn: () => api.admin.reports(status), enabled: allowed });
  const review = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'reviewing' | 'actioned' | 'dismissed' }) => api.admin.resolveReport(id, { status: decision, resolution: notes[id] || null }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['admin-reports'] }); await qc.invalidateQueries({ queryKey: ['admin-stats'] }); } });
  return <PageContainer><h1 className="mb-6 font-display text-3xl font-semibold">Admin</h1>{!me ? <ListSkeleton /> : !allowed ? <p>Staff access is required.</p> : <>
    {stats.error && <ErrorState error={stats.error} />}{stats.data && <div className="mb-8 grid gap-3 sm:grid-cols-4">{[['Users', stats.data.users.total], ['Crews', stats.data.crews.total], ['Messages today', stats.data.messages.last24h], ['Open reports', stats.data.reports.open]].map(([label, count]) => <div key={label} className="rounded-xl border border-line bg-surface p-4"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-semibold">{count}</p></div>)}</div>}
    <SectionTitle title="Reports" action={<NativeSelect aria-label="Report status" value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)}>{['open', 'reviewing', 'actioned', 'dismissed'].map((s) => <option key={s} value={s}>{s}</option>)}</NativeSelect>} />
    {review.error && <ErrorState error={review.error} />}{reports.isLoading && <ListSkeleton />}{reports.error && <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />}
    {reports.data?.items.length === 0 && <EmptyState title="No reports in this queue" />}
    <div className="grid gap-4">{reports.data?.items.map((report) => <article key={report.id} className="grid gap-3 rounded-xl border border-line bg-surface p-5"><h2 className="font-semibold">{report.target.type} · {report.reason}</h2><p className="text-xs text-muted">Reported by {report.reporter?.displayName ?? 'Deleted user'} · {new Date(report.createdAt).toLocaleString()}</p><p className="text-sm whitespace-pre-wrap">{report.context?.excerpt}</p>{report.details && <p className="text-sm text-muted">{report.details}</p>}<Textarea aria-label="Review note" placeholder="Review note" value={notes[report.id] ?? report.resolution ?? ''} onChange={(e) => setNotes({ ...notes, [report.id]: e.target.value })} maxLength={2000} /><div className="flex flex-wrap gap-2">{(['reviewing', 'actioned', 'dismissed'] as const).map((decision) => <Button key={decision} variant={decision === 'actioned' ? 'primary' : 'secondary'} size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: report.id, decision })}>{decision === 'reviewing' ? 'Review' : decision === 'actioned' ? 'Mark handled' : 'Dismiss'}</Button>)}</div></article>)}</div>
  </>}</PageContainer>;
}
