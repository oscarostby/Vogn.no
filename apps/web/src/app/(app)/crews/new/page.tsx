'use client';

import { CREW_CATEGORIES, CREW_VISIBILITIES } from '@vogn/types';
import { crewCreateSchema, type CrewCreateInput } from '@vogn/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageContainer } from '@/components/app/page';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { ErrorState, PageHeader } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';

const visibilityLabels = { public: 'Open — anyone can join', application: 'Application — approve new members', invite_only: 'Invite only — visible in discovery', hidden: 'Hidden — invitations only' };

export default function CreateCrewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<CrewCreateInput>({ name: '', slug: '', description: '', category: 'general', visibility: 'public', country: 'NO', region: '', language: 'en', template: 'standard', themePreset: 'vogn-minimal' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugEdited, setSlugEdited] = useState(false);
  const create = useMutation({ mutationFn: api.crews.create, onSuccess: (crew) => { void qc.invalidateQueries({ queryKey: queryKeys.myCrews }); void qc.invalidateQueries({ queryKey: queryKeys.home }); router.push(`/c/${crew.slug}`); } });
  const update = <K extends keyof CrewCreateInput>(key: K, value: CrewCreateInput[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = crewCreateSchema.safeParse(form);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
    setErrors({}); create.mutate(parsed.data);
  };
  return (
    <PageContainer width="narrow">
      <PageHeader title="Start a crew" description="Create a home for your friends, club or local car community." />
      <form onSubmit={submit} className="grid gap-5 rounded-xl border border-line bg-surface p-5 md:p-7">
        <Field label="Crew name" error={errors.name}>{(props) => <Input {...props} required minLength={2} maxLength={50} value={form.name} onChange={(event) => { const name = event.target.value; setForm((prev) => ({ ...prev, name, slug: slugEdited ? prev.slug : name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) })); }} />}</Field>
        <Field label="Address" error={errors.slug} help={`vogn.no/c/${form.slug || 'your-crew'}`}>{(props) => <Input {...props} required minLength={3} maxLength={32} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => { setSlugEdited(true); update('slug', event.target.value.toLowerCase()); }} />}</Field>
        <Field label="About your crew" optional error={errors.description}>{(props) => <Textarea {...props} maxLength={1000} value={form.description ?? ''} onChange={(event) => update('description', event.target.value)} />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" error={errors.category}>{(props) => <NativeSelect {...props} value={form.category} onChange={(event) => update('category', event.target.value as CrewCreateInput['category'])}>{CREW_CATEGORIES.map((category) => <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>)}</NativeSelect>}</Field>
          <Field label="Who can join?" error={errors.visibility}>{(props) => <NativeSelect {...props} value={form.visibility} onChange={(event) => update('visibility', event.target.value as CrewCreateInput['visibility'])}>{CREW_VISIBILITIES.map((visibility) => <option key={visibility} value={visibility}>{visibilityLabels[visibility]}</option>)}</NativeSelect>}</Field>
          <Field label="Country code" help="Two letters, for example NO." error={errors.country}>{(props) => <Input {...props} maxLength={2} value={form.country ?? ''} onChange={(event) => update('country', (event.target.value.toUpperCase() || null) as CrewCreateInput['country'])} />}</Field>
          <Field label="Region" optional error={errors.region}>{(props) => <Input {...props} maxLength={60} value={form.region ?? ''} onChange={(event) => update('region', event.target.value)} />}</Field>
        </div>
        {create.error && <ErrorState error={create.error} />}
        <div className="flex justify-end gap-2"><Button asChild variant="ghost"><Link href="/crews">Cancel</Link></Button><Button type="submit" loading={create.isPending}>Create crew</Button></div>
      </form>
    </PageContainer>
  );
}
