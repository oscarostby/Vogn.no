'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { THEME_PRESET_IDS, presetManifest, resolveTheme, themeManifestSchema, type ThemeManifest } from '@vogn/theme-engine';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageContainer } from '@/components/app/page';
import { CrewHeader } from '@/components/crew-theme/crew-header';
import { PageRenderer } from '@/components/crew-theme/page-renderer';
import { CrewThemeScope } from '@/components/crew-theme/theme-scope';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { ErrorState, ListSkeleton } from '@/components/ui/states';
import { api, queryKeys } from '@/lib/api';

export function CrewStudio({ slug }: { slug: string }) {
  const qc = useQueryClient();
  const crew = useQuery({ queryKey: ['crew', slug], queryFn: () => api.crews.get(slug) });
  const saved = useQuery({ queryKey: queryKeys.crewStudio(crew.data?.id ?? ''), queryFn: () => api.crews.theme.studio(crew.data!.id), enabled: Boolean(crew.data?.viewer.permissions.includes('MANAGE_THEMES')) });
  const versions = useQuery({ queryKey: ['theme-versions', crew.data?.id], queryFn: () => api.crews.theme.versions(crew.data!.id), enabled: Boolean(saved.data) });
  const [edited, setDraft] = useState<ThemeManifest | null>(null);
  const draft = edited ?? saved.data?.draft ?? null;
  const [jsonOverride, setJson] = useState<string | null>(null);
  const json = jsonOverride ?? (draft ? JSON.stringify(draft, null, 2) : '');
  const [note, setNote] = useState('');
  const change = (next: ThemeManifest) => { setDraft(next); setJson(JSON.stringify(next, null, 2)); };
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!draft || !crew.data) throw new Error('Load a crew first.');
      await api.crews.theme.saveDraft(crew.data.id, draft);
      if (publish) await api.crews.theme.publish(crew.data.id, note || undefined);
    },
    onSuccess: async (_, publish) => { await qc.invalidateQueries({ queryKey: queryKeys.crewStudio(crew.data!.id) }); await qc.invalidateQueries({ queryKey: ['theme-versions'] }); await qc.invalidateQueries({ queryKey: queryKeys.crewTheme(crew.data!.id) }); setDraft(null); setJson(null); toast.success(publish ? 'Theme published' : 'Draft saved'); },
  });
  const restore = useMutation({ mutationFn: (version: number) => api.crews.theme.restore(crew.data!.id, version), onSuccess: async () => { await qc.invalidateQueries({ queryKey: queryKeys.crewStudio(crew.data!.id) }); setDraft(null); setJson(null); toast.success('Version restored to draft'); } });
  if (crew.isLoading || saved.isLoading) return <PageContainer><ListSkeleton rows={5} /></PageContainer>;
  if (crew.error || saved.error) return <PageContainer><ErrorState error={crew.error ?? saved.error} /></PageContainer>;
  if (!crew.data?.viewer.permissions.includes('MANAGE_THEMES')) return <PageContainer>You need permission to manage this crew’s theme.</PageContainer>;
  if (!crew.data || !draft) return null;
  const theme = resolveTheme(draft);
  const page = draft.pages.find((p) => p.slug === 'home') ?? draft.pages[0]!;
  return <PageContainer width="wide">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><Link href={`/c/${slug}`} className="text-sm text-accent-text">← {crew.data.name}</Link><h1 className="font-display text-3xl font-semibold">Crew Studio</h1><p className="mt-1 text-sm text-muted">Preview, save a draft, then publish it to your crew.</p></div><div className="flex gap-2"><Button variant="secondary" disabled={save.isPending || restore.isPending} onClick={() => save.mutate(false)}>Save draft</Button><Button disabled={save.isPending || restore.isPending} onClick={() => save.mutate(true)}>Publish</Button></div></header>
    {save.error && <ErrorState error={save.error} />}{restore.error && <ErrorState error={restore.error} />}
    <div className="grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]"><aside className="grid gap-5 rounded-xl border border-line bg-surface p-5">
      <label className="grid gap-2 text-sm">Preset<NativeSelect value={draft.meta.presetId ?? ''} onChange={(e) => change(presetManifest(e.target.value))}><option value="" disabled>Custom theme</option>{THEME_PRESET_IDS.map((id) => <option key={id} value={id}>{presetManifest(id).meta.name}</option>)}</NativeSelect></label>
      <label className="grid gap-2 text-sm">Theme name<Input value={draft.meta.name} maxLength={80} onChange={(e) => change({ ...draft, meta: { ...draft.meta, name: e.target.value } })} /></label>
      {(['primary', 'accent', 'background', 'surface', 'text'] as const).map((key) => <label key={key} className="flex items-center justify-between gap-3 text-sm capitalize">{key}<input aria-label={`${key} color`} type="color" value={draft.colors[key]} onChange={(e) => change({ ...draft, colors: { ...draft.colors, [key]: e.target.value }, ...(key === 'background' ? { background: { ...draft.background, color: e.target.value } } : {}) })} /></label>)}
      <label className="grid gap-2 text-sm">Version note<Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
      {theme.corrections.length > 0 && <p className="text-xs text-muted">{theme.corrections.join(' ')}</p>}
      <details><summary className="cursor-pointer text-sm font-medium">Edit full theme JSON</summary><Textarea className="mt-3 min-h-64 font-mono text-xs" aria-label="Theme JSON" value={json} onChange={(e) => setJson(e.target.value)} /><Button size="sm" className="mt-2" onClick={() => { try { change(themeManifestSchema.parse(JSON.parse(json))); toast.success('Preview updated'); } catch { toast.error('Invalid theme JSON. Check the theme schema.'); } }}>Apply JSON to preview</Button></details>
      <Button asChild variant="ghost" size="sm"><a href={api.crews.theme.exportUrl(crew.data.id)}>Export saved draft</a></Button>
      {versions.data?.length ? <div><h2 className="mb-2 text-sm font-semibold">Published versions</h2>{versions.data.map((v) => <div key={v.version} className="mb-2 flex items-center justify-between gap-2 text-xs"><span>v{v.version} · {v.name}</span><Button size="sm" variant="ghost" disabled={restore.isPending || save.isPending} onClick={() => restore.mutate(v.version)}>Restore</Button></div>)}</div> : null}
    </aside><CrewThemeScope manifest={draft} resolved={theme} className="overflow-hidden rounded-xl border border-line"><CrewHeader crew={{ ...crew.data, categoryLabel: crew.data.category }} theme={theme} /><PageRenderer page={page} manifest={draft} ctx={{ crewId: crew.data.id, crewSlug: slug, crewName: crew.data.name, crewRules: crew.data.rules, foundedAt: crew.data.createdAt, isMember: true, data: {}, mode: 'editor', locale: 'en' }} /></CrewThemeScope></div>
  </PageContainer>;
}
