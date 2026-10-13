'use client';

import { DEFAULT_THEME, resolveTheme } from '@vogn/theme-engine';
import type { CrewDetail } from '@vogn/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Hash, Plus, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { PageContainer, SectionTitle } from '@/components/app/page';
import { CrewHeader } from '@/components/crew-theme/crew-header';
import { PageRenderer } from '@/components/crew-theme/page-renderer';
import { CrewThemeScope } from '@/components/crew-theme/theme-scope';
import { Button } from '@/components/ui/button';
import { Avatar, Badge } from '@/components/ui/display';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';
import { ChannelList } from './channel-list';

function ApplyForm({ crew, onSubmitted }: { crew: CrewDetail; onSubmitted: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [consent, setConsent] = useState(false);
  const [referral, setReferral] = useState('');
  const application = useMutation({ mutationFn: () => api.crews.apply(crew.id, { answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value })), consent: true, referralCode: referral || null }), onSuccess: onSubmitted });
  return <form className="grid gap-4 rounded-xl border border-line bg-surface p-5" onSubmit={(event) => { event.preventDefault(); if (consent) application.mutate(); }}>
    <h2 className="font-semibold">Apply to join</h2>
    {crew.applicationForm?.intro && <p className="text-sm text-muted">{crew.applicationForm.intro}</p>}
    {crew.applicationForm?.questions.map((question) => <Field key={question.id} label={question.label} help={question.help} optional={!question.required}>{(props) => question.kind === 'single_choice' ? <NativeSelect {...props} required={question.required} value={String(answers[question.id] ?? '')} onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}><option value="">Select…</option>{question.options.map((option) => <option key={option}>{option}</option>)}</NativeSelect> : question.kind === 'multi_choice' ? <div className="grid gap-2">{question.options.map((option) => <label key={option} className="flex gap-2 text-sm"><input type="checkbox" checked={Array.isArray(answers[question.id]) && (answers[question.id] as string[]).includes(option)} onChange={(event) => setAnswers((prev) => { const values = Array.isArray(prev[question.id]) ? prev[question.id] as string[] : []; return { ...prev, [question.id]: event.target.checked ? [...values, option] : values.filter((value) => value !== option) }; })} />{option}</label>)}</div> : <Textarea {...props} required={question.required} maxLength={2000} value={String(answers[question.id] ?? '')} onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))} />}</Field>)}
    {crew.requirements.invitationOrReferral && <Field label="Referral code">{(props) => <Input {...props} required value={referral} onChange={(event) => setReferral(event.target.value)} />}</Field>}
    <label className="flex items-start gap-2 text-sm text-muted"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1" />I agree to share these answers with the crew’s reviewers.</label>
    {application.error && <ErrorState error={application.error} />}
    <Button type="submit" disabled={!consent} loading={application.isPending}>Submit application</Button>
  </form>;
}

function CrewManagement({ crew, refresh }: { crew: CrewDetail; refresh: () => void }) {
  const qc = useQueryClient();
  const [channelName, setChannelName] = useState('');
  const [invite, setInvite] = useState('');
  const [name, setName] = useState(crew.name);
  const [description, setDescription] = useState(crew.description ?? '');
  const [rules, setRules] = useState(crew.rules.join('\n'));
  const [visibility, setVisibility] = useState(crew.visibility);
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const can = (permission: typeof crew.viewer.permissions[number]) => crew.viewer.permissions.includes(permission);
  const applications = useQuery({ queryKey: ['crew', crew.id, 'applications'], queryFn: () => api.crews.applications(crew.id), enabled: can('APPROVE_APPLICANTS') });
  const perform = async (fn: () => Promise<unknown>) => { setBusy(true); setFailure(null); try { await fn(); refresh(); } catch (cause) { setFailure(cause); } finally { setBusy(false); } };
  if (!can('MANAGE_CREW') && !can('CREATE_CHANNELS') && !can('CREATE_INVITES') && !can('APPROVE_APPLICANTS')) return null;
  return <details className="rounded-xl border border-line bg-surface p-5"><summary className="cursor-pointer font-semibold">Manage this crew</summary><div className="mt-5 grid gap-6">
    {can('MANAGE_CREW') && <form onSubmit={(event) => { event.preventDefault(); void perform(() => api.crews.update(crew.id, { name, description, rules: rules.split('\n').map((rule) => rule.trim()).filter(Boolean), visibility })); }} className="grid gap-3">
      <Field label="Crew name">{(props) => <Input {...props} required minLength={2} maxLength={50} value={name} onChange={(event) => setName(event.target.value)} />}</Field>
      <Field label="Description">{(props) => <Textarea {...props} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />}</Field>
      <Field label="Rules" help="One rule per line, up to 20 rules.">{(props) => <Textarea {...props} value={rules} onChange={(event) => setRules(event.target.value)} />}</Field>
      <Field label="Visibility">{(props) => <NativeSelect {...props} value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}><option value="public">Open</option><option value="application">Application</option><option value="invite_only">Invite only</option><option value="hidden">Hidden</option></NativeSelect>}</Field>
      <Button type="submit" size="sm" loading={busy} className="justify-self-start">Save crew</Button>
    </form>}
    {can('CREATE_CHANNELS') && <form onSubmit={(event) => { event.preventDefault(); void perform(async () => { await api.crews.createChannel(crew.id, { name: channelName, type: 'text' }); setChannelName(''); await qc.invalidateQueries({ queryKey: queryKeys.crewChannels(crew.id) }); }); }} className="flex items-end gap-2"><Field label="New text channel" className="flex-1">{(props) => <Input {...props} required maxLength={40} value={channelName} onChange={(event) => setChannelName(event.target.value)} placeholder="general" />}</Field><Button type="submit" loading={busy}><Plus /> Create</Button></form>}
    {can('CREATE_INVITES') && <div className="grid gap-2"><Button variant="secondary" size="sm" loading={busy} className="justify-self-start" onClick={() => void perform(async () => { const result = await api.crews.createInvite(crew.id, { expiresInHours: 168 }); setInvite(`${window.location.origin}/invite/${result.code}`); })}>Create invitation link</Button>{invite && <Input aria-label="Invitation link" value={invite} readOnly onFocus={(event) => event.target.select()} />}</div>}
    {can('APPROVE_APPLICANTS') && <section><SectionTitle title="Pending applications" />{applications.isPending ? <ListSkeleton rows={2} /> : applications.error ? <ErrorState error={applications.error} onRetry={() => void applications.refetch()} /> : !applications.data?.items.length ? <p className="text-sm text-muted">No pending applications.</p> : <div className="grid gap-3">{applications.data.items.map((application) => <div key={application.id} className="rounded-lg border border-line p-3"><Link href={`/u/${application.applicant.username}`} className="font-semibold">{application.applicant.displayName}</Link>{application.answers.map((answer) => <p key={answer.questionId} className="mt-2 text-sm text-muted"><strong>{answer.label}:</strong> {Array.isArray(answer.value) ? answer.value.join(', ') : answer.value}</p>)}<div className="mt-3 flex gap-2"><Button size="sm" loading={busy} onClick={() => void perform(async () => { await api.crews.reviewApplication(crew.id, application.id, { decision: 'approve' }); await applications.refetch(); })}>Approve</Button><Button size="sm" variant="danger-ghost" loading={busy} onClick={() => void perform(async () => { await api.crews.reviewApplication(crew.id, application.id, { decision: 'reject' }); await applications.refetch(); })}>Reject</Button></div></div>)}</div>}</section>}
    {Boolean(failure) && <ErrorState error={failure} />}
  </div></details>;
}

export function CrewView({ slug }: { slug: string }) {
  const locale = useLocale();
  const qc = useQueryClient();
  const crewQuery = useQuery({ queryKey: queryKeys.crew(slug), queryFn: () => api.crews.get(slug) });
  const crew = crewQuery.data;
  const isMember = crew?.viewer.status === 'member' || crew?.viewer.status === 'timed_out';
  const channels = useQuery({ queryKey: queryKeys.crewChannels(crew?.id ?? ''), queryFn: () => api.crews.channels(crew!.id), enabled: Boolean(crew && isMember) });
  const members = useQuery({ queryKey: queryKeys.crewMembers(crew?.id ?? ''), queryFn: () => api.crews.members(crew!.id), enabled: Boolean(crew && isMember) });
  const theme = useQuery({ queryKey: queryKeys.crewTheme(crew?.id ?? ''), queryFn: () => api.crews.theme.published(crew!.id), enabled: Boolean(crew), retry: false });
  const events = useQuery({ queryKey: queryKeys.events('upcoming', crew?.id), queryFn: () => api.events.list({ crewId: crew!.id, scope: 'upcoming' }), enabled: Boolean(crew) });
  const [apply, setApply] = useState(false);
  const refresh = () => { void crewQuery.refetch(); void qc.invalidateQueries({ queryKey: queryKeys.myCrews }); void qc.invalidateQueries({ queryKey: queryKeys.home }); };
  const join = useMutation({ mutationFn: () => api.crews.join(crew!.id), onSuccess: refresh });
  const leave = useMutation({ mutationFn: () => api.crews.leave(crew!.id), onSuccess: refresh });
  const withdraw = useMutation({ mutationFn: () => api.crews.withdrawApplication(crew!.id), onSuccess: refresh });
  if (crewQuery.isPending) return <PageContainer><ListSkeleton rows={6} /></PageContainer>;
  if (!crew || crewQuery.error) return <PageContainer><ErrorState error={crewQuery.error} onRetry={() => void crewQuery.refetch()} /></PageContainer>;
  const manifest = theme.data?.manifest ?? DEFAULT_THEME;
  const resolved = resolveTheme(manifest);
  const page = manifest.pages.find((item) => item.id === 'home') ?? manifest.pages[0];
  const widgetData: Record<string, unknown> = {};
  for (const widget of page?.sections.flatMap((section) => section.widgets) ?? []) {
    switch (widget.type) {
      case 'rules': widgetData[widget.id] = { items: crew.rules }; break;
      case 'member_count': widgetData[widget.id] = { members: crew.memberCount, online: null, avatars: members.data?.items.slice(0, 6).map((member) => member.user) ?? [] }; break;
      case 'channel_list': widgetData[widget.id] = { channels: channels.data ?? [] }; break;
      case 'upcoming_meets': case 'event_calendar': widgetData[widget.id] = { events: events.data?.items ?? [] }; break;
      case 'countdown': widgetData[widget.id] = { event: events.data?.items[0] ?? null }; break;
    }
  }
  const actions = <>
    {crew.viewer.permissions.includes('MANAGE_THEMES') && <Button asChild variant="secondary" size="sm"><Link href={`/c/${slug}/studio`}><Settings /> Crew Studio</Link></Button>}
    {crew.viewer.canJoinDirectly && <Button size="sm" loading={join.isPending} onClick={() => join.mutate()}>Join crew</Button>}
    {crew.viewer.canApply && <Button size="sm" onClick={() => setApply((value) => !value)}>Apply to join</Button>}
    {isMember && <Badge tone="accent">Member</Badge>}
  </>;
  return <>
    <CrewThemeScope manifest={manifest} resolved={resolved}>
      <CrewHeader crew={{ ...crew, categoryLabel: crew.category.replaceAll('_', ' ') }} theme={resolved} actions={actions} />
      {page && <PageRenderer manifest={manifest} page={page} ctx={{ crewId: crew.id, crewSlug: crew.slug, crewName: crew.name, crewRules: crew.rules, foundedAt: crew.createdAt, isMember, data: widgetData, mode: 'live', locale, joinAction: actions }} />}
    </CrewThemeScope>
    <PageContainer className="grid gap-6">
      {(join.error || leave.error || withdraw.error) && <ErrorState error={join.error ?? leave.error ?? withdraw.error} />}
      {crew.viewer.missingRequirements.length > 0 && <div className="rounded-lg border border-line p-4 text-sm text-muted">Joining requires: {crew.viewer.missingRequirements.map((requirement) => requirement.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')}. {crew.requirements.explanation}</div>}
      {crew.viewer.status === 'pending_application' && <div className="flex items-center justify-between gap-3 rounded-lg border border-line p-4"><p className="text-sm text-muted">Your application is waiting for review.</p><Button variant="ghost" size="sm" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>Withdraw</Button></div>}
      {apply && crew.viewer.canApply && <ApplyForm crew={crew} onSubmitted={() => { setApply(false); refresh(); }} />}
      {isMember ? <div className="grid items-start gap-6 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-line bg-surface p-4"><SectionTitle title="Channels" />{channels.isPending ? <ListSkeleton rows={3} /> : channels.error ? <ErrorState error={channels.error} onRetry={() => void channels.refetch()} /> : channels.data?.length ? <ChannelList channels={channels.data} slug={slug} /> : <EmptyState icon={Hash} title="No channels yet" className="py-8" />}</section>
        <section><SectionTitle title="Members" />{members.isPending ? <ListSkeleton /> : members.error ? <ErrorState error={members.error} onRetry={() => void members.refetch()} /> : <div className="grid gap-2 sm:grid-cols-2">{members.data?.items.map((member) => <Link key={member.userId} href={`/u/${member.user.username}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3"><Avatar name={member.user.displayName} image={member.user.avatar} accent={member.accentColor ?? member.user.accentColor} /><div className="grid min-w-0 gap-0.5"><p className="truncate text-sm font-medium">{member.nickname ?? member.user.displayName}</p><p className="text-xs text-muted">@{member.user.username}</p></div>{member.isOwner && <Badge className="ml-auto">Owner</Badge>}</Link>)}</div>}</section>
      </div> : <EmptyState icon={Users} title={crew.visibility === 'invite_only' || crew.visibility === 'hidden' ? 'Join through an invitation' : 'Join the crew to see channels and members'} description={crew.visibility === 'invite_only' ? 'Ask a member for an invitation link.' : crew.description} />}
      {isMember && <CrewManagement crew={crew} refresh={refresh} />}
      {isMember && !crew.viewer.isOwner && <Button variant="danger-ghost" size="sm" className="justify-self-start" loading={leave.isPending} onClick={() => { if (window.confirm(`Leave ${crew.name}?`)) leave.mutate(); }}>Leave crew</Button>}
    </PageContainer>
  </>;
}
